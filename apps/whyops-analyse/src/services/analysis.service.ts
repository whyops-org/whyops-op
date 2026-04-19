import { createServiceLogger } from '@whyops/shared/logger';
import { LLMEvent, Trace, TraceAnalysis, TraceAnalysisFinding } from '@whyops/shared/models';

const logger = createServiceLogger('analyse:analysis-service');

type AnalysisMode = 'quick' | 'standard' | 'deep';

interface RunStaticAnalysisInput {
  traceId: string;
  userId: string;
  mode?: AnalysisMode;
}

interface StaticFinding {
  stepId?: number;
  dimension: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidence: Record<string, any>;
  recommendation?: Record<string, any>;
}

interface NumericDistribution {
  values: number[];
  p95: number;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[index];
}

function parseNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function extractLatencyMs(event: LLMEvent): number | undefined {
  return (
    parseNumeric((event.metadata as any)?.latencyMs) ??
    parseNumeric((event.metadata as any)?.latency_ms) ??
    parseNumeric((event.content as any)?.latencyMs) ??
    parseNumeric((event.content as any)?.latency_ms)
  );
}

function extractTotalTokens(event: LLMEvent): number | undefined {
  return (
    parseNumeric((event.metadata as any)?.usage?.totalTokens) ??
    parseNumeric((event.metadata as any)?.usage?.total_tokens) ??
    parseNumeric((event.metadata as any)?.totalTokens) ??
    parseNumeric((event.metadata as any)?.total_tokens) ??
    parseNumeric((event.content as any)?.usage?.totalTokens) ??
    parseNumeric((event.content as any)?.usage?.total_tokens) ??
    parseNumeric((event.content as any)?.totalTokens) ??
    parseNumeric((event.content as any)?.total_tokens)
  );
}

function extractToolCalls(event: LLMEvent): any[] {
  const content = event.content as any;
  const toolCalls = content?.toolCalls || content?.tool_calls || [];
  return Array.isArray(toolCalls) ? toolCalls : [];
}

function toolCallSignature(toolCall: any): string {
  const functionName = toolCall?.function?.name || toolCall?.name || 'unknown';
  const rawArgs = toolCall?.function?.arguments ?? toolCall?.arguments ?? {};
  let normalizedArgs = rawArgs;
  if (typeof rawArgs === 'string') {
    try {
      normalizedArgs = JSON.parse(rawArgs);
    } catch {
      normalizedArgs = rawArgs;
    }
  }
  return `${functionName}::${JSON.stringify(normalizedArgs)}`;
}

export class AnalysisService {
  static async runStaticAnalysis(input: RunStaticAnalysisInput) {
    const mode: AnalysisMode = input.mode || 'standard';
    const now = new Date();

    const trace = await Trace.findOne({
      where: {
        id: input.traceId,
        userId: input.userId,
      },
      attributes: ['id', 'userId', 'entityId', 'model', 'sampledIn', 'createdAt'],
    });

    if (!trace) {
      throw new Error('TRACE_NOT_FOUND');
    }

    const analysis = await TraceAnalysis.create({
      traceId: trace.id,
      status: 'running',
      rubricVersion: 'static-v1',
      judgeModel: undefined,
      mode,
      startedAt: now,
      summary: {
        analyzer: 'static-v1',
        mode,
      },
    });

    try {
      const events = await LLMEvent.findAll({
        where: { traceId: trace.id, userId: input.userId },
        attributes: ['id', 'stepId', 'parentStepId', 'spanId', 'eventType', 'timestamp', 'content', 'metadata'],
        order: [
          ['timestamp', 'ASC'],
          ['stepId', 'ASC'],
        ],
      });

      const findings = this.generateDeterministicFindings(trace, events, mode);

      if (findings.length > 0) {
        await TraceAnalysisFinding.bulkCreate(
          findings.map((finding) => ({
            analysisId: analysis.id,
            stepId: finding.stepId,
            dimension: finding.dimension,
            severity: finding.severity,
            confidence: finding.confidence,
            evidence: finding.evidence,
            recommendation: finding.recommendation,
          }))
        );
      }

      const bySeverity = findings.reduce<Record<string, number>>((acc, finding) => {
        acc[finding.severity] = (acc[finding.severity] || 0) + 1;
        return acc;
      }, {});

      const byDimension = findings.reduce<Record<string, number>>((acc, finding) => {
        acc[finding.dimension] = (acc[finding.dimension] || 0) + 1;
        return acc;
      }, {});

      const summary = {
        analyzer: 'static-v1',
        mode,
        traceId: trace.id,
        eventCount: events.length,
        sampledIn: trace.sampledIn,
        findingCount: findings.length,
        bySeverity,
        byDimension,
      };

      await analysis.update({
        status: 'completed',
        finishedAt: new Date(),
        summary,
      });

      return {
        id: analysis.id,
        traceId: trace.id,
        status: 'completed',
        rubricVersion: 'static-v1',
        mode,
        summary,
      };
    } catch (error: any) {
      logger.error({ error, traceId: input.traceId, analysisId: analysis.id }, 'Static analysis failed');
      await analysis.update({
        status: 'failed',
        finishedAt: new Date(),
        summary: {
          ...(analysis.summary || {}),
          error: error?.message || 'UNKNOWN_ERROR',
        },
      });
      throw error;
    }
  }

  static async getAnalysisById(analysisId: string, userId: string) {
    const analysis = await TraceAnalysis.findOne({
      where: { id: analysisId },
      include: [
        {
          model: Trace,
          as: 'trace',
          attributes: ['id', 'userId'],
          required: true,
          where: { userId },
        },
      ],
    });

    if (!analysis) return null;

    const findings = await TraceAnalysisFinding.findAll({
      where: { analysisId: analysis.id },
      order: [['createdAt', 'ASC']],
    });

    return {
      ...(analysis.toJSON() as any),
      findings,
    };
  }

  static async listAnalysesByTrace(traceId: string, userId: string) {
    const trace = await Trace.findOne({
      where: { id: traceId, userId },
      attributes: ['id'],
    });

    if (!trace) {
      return null;
    }

    return TraceAnalysis.findAll({
      where: { traceId },
      attributes: ['id', 'traceId', 'status', 'rubricVersion', 'judgeModel', 'mode', 'startedAt', 'finishedAt', 'summary', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
    });
  }

  private static buildDistribution(values: number[]): NumericDistribution {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      values: sorted,
      p95: percentile(sorted, 95),
    };
  }

  private static generateDeterministicFindings(trace: Trace, events: LLMEvent[], mode: AnalysisMode): StaticFinding[] {
    const findings: StaticFinding[] = [];

    if (events.length === 0) {
      findings.push({
        dimension: 'trace_integrity',
        severity: 'critical',
        confidence: 1.0,
        evidence: {
          traceId: trace.id,
          reason: 'TRACE_HAS_NO_EVENTS',
        },
        recommendation: {
          action: 'verify_ingestion_pipeline',
          detail: 'Trace exists but no events were recorded. Verify agent logging and proxy->analyse delivery.',
        },
      });
      return findings;
    }

    const stepIdSet = new Set<number>();
    const duplicateStepMap = new Map<number, string[]>();
    const spanRequestStep = new Map<string, number>();
    const spanResponseStep = new Map<string, number>();

    let previousEvent: LLMEvent | null = null;
    let consecutiveErrors = 0;
    let maxConsecutiveErrors = 0;

    for (const event of events) {
      if (previousEvent && event.stepId < previousEvent.stepId) {
        findings.push({
          stepId: event.stepId,
          dimension: 'trace_integrity',
          severity: 'high',
          confidence: 1.0,
          evidence: {
            eventId: event.id,
            previousEventId: previousEvent.id,
            previousStepId: previousEvent.stepId,
            currentStepId: event.stepId,
            previousTimestamp: previousEvent.timestamp,
            currentTimestamp: event.timestamp,
            issue: 'STEP_ORDER_DECREASED',
          },
          recommendation: {
            action: 'enforce_monotonic_steps',
            detail: 'Ensure step IDs increase with time, or explicitly mark late-arrival events.',
          },
        });
      }

      if (stepIdSet.has(event.stepId)) {
        const existing = duplicateStepMap.get(event.stepId) || [];
        existing.push(event.id);
        duplicateStepMap.set(event.stepId, existing);
      } else {
        stepIdSet.add(event.stepId);
      }

      if (event.eventType === 'error') {
        consecutiveErrors += 1;
        maxConsecutiveErrors = Math.max(maxConsecutiveErrors, consecutiveErrors);
      } else {
        consecutiveErrors = 0;
      }

      if (event.eventType === 'tool_call_request' && event.spanId) {
        spanRequestStep.set(event.spanId, event.stepId);
      }
      if (event.eventType === 'tool_call_response' && event.spanId) {
        spanResponseStep.set(event.spanId, event.stepId);
      }

      previousEvent = event;
    }

    for (const [stepId, eventIds] of duplicateStepMap.entries()) {
      findings.push({
        stepId,
        dimension: 'trace_integrity',
        severity: 'medium',
        confidence: 1.0,
        evidence: {
          stepId,
          eventIds,
          duplicateCount: eventIds.length + 1,
          issue: 'DUPLICATE_STEP_ID',
        },
        recommendation: {
          action: 'stabilize_step_assignment',
          detail: 'Use deterministic step allocation and idempotency keys for retried emissions.',
        },
      });
    }

    for (const event of events) {
      if (event.parentStepId && !stepIdSet.has(event.parentStepId)) {
        findings.push({
          stepId: event.stepId,
          dimension: 'trace_integrity',
          severity: 'high',
          confidence: 1.0,
          evidence: {
            eventId: event.id,
            stepId: event.stepId,
            parentStepId: event.parentStepId,
            issue: 'MISSING_PARENT_STEP',
          },
          recommendation: {
            action: 'fix_parent_linking',
            detail: 'Ensure parentStepId points to an existing step in the same trace.',
          },
        });
      }
    }

    for (const [spanId, requestStepId] of spanRequestStep.entries()) {
      const responseStepId = spanResponseStep.get(spanId);
      if (responseStepId === undefined) {
        findings.push({
          stepId: requestStepId,
          dimension: 'tool_execution',
          severity: 'high',
          confidence: 1.0,
          evidence: {
            spanId,
            requestStepId,
            issue: 'MISSING_TOOL_CALL_RESPONSE',
          },
          recommendation: {
            action: 'ensure_tool_response_event',
            detail: 'Emit tool_call_response for every tool_call_request.',
          },
        });
      }
    }

    for (const [spanId, responseStepId] of spanResponseStep.entries()) {
      const requestStepId = spanRequestStep.get(spanId);
      if (requestStepId === undefined) {
        findings.push({
          stepId: responseStepId,
          dimension: 'tool_execution',
          severity: 'medium',
          confidence: 1.0,
          evidence: {
            spanId,
            responseStepId,
            issue: 'ORPHAN_TOOL_CALL_RESPONSE',
          },
          recommendation: {
            action: 'emit_request_before_response',
            detail: 'Ensure request/response tool call event pairs share the same span.',
          },
        });
      }
    }

    for (const event of events) {
      if (event.eventType === 'llm_response') {
        if (!(event.metadata as any)?.model || !(event.metadata as any)?.provider) {
          findings.push({
            stepId: event.stepId,
            dimension: 'schema_mismatch',
            severity: 'high',
            confidence: 1.0,
            evidence: {
              eventId: event.id,
              hasModel: Boolean((event.metadata as any)?.model),
              hasProvider: Boolean((event.metadata as any)?.provider),
              issue: 'LLM_RESPONSE_METADATA_INCOMPLETE',
            },
            recommendation: {
              action: 'enforce_llm_response_metadata',
              detail: 'Always send metadata.model and metadata.provider for llm_response.',
            },
          });
        }

        const toolCalls = extractToolCalls(event);
        if (toolCalls.length > 0) {
          const hasFollowup = events.some((candidate) => {
            if (candidate.stepId <= event.stepId) return false;
            return (
              candidate.eventType === 'tool_result' ||
              candidate.eventType === 'tool_call_request' ||
              candidate.eventType === 'tool_call_response'
            );
          });

          if (!hasFollowup) {
            findings.push({
              stepId: event.stepId,
              dimension: 'tool_execution',
              severity: 'medium',
              confidence: 0.95,
              evidence: {
                eventId: event.id,
                toolCallCount: toolCalls.length,
                issue: 'TOOL_CALL_WITHOUT_FOLLOWUP_EVENTS',
              },
              recommendation: {
                action: 'emit_tool_followups',
                detail: 'Log tool execution events after llm_response tool calls for complete traces.',
              },
            });
          }
        }
      }

      if ((event.eventType === 'tool_call_request' || event.eventType === 'tool_call_response') && !(event.metadata as any)?.tool) {
        findings.push({
          stepId: event.stepId,
          dimension: 'schema_mismatch',
          severity: 'low',
          confidence: 1.0,
          evidence: {
            eventId: event.id,
            eventType: event.eventType,
            issue: 'MISSING_METADATA_TOOL',
          },
          recommendation: {
            action: 'include_tool_name_in_metadata',
            detail: 'Include metadata.tool on tool_call_request/tool_call_response for cleaner analysis.',
          },
        });
      }
    }

    const toolRequestEvents = events.filter((event) => event.eventType === 'tool_call_request');
    let consecutiveIdenticalCalls = 1;
    for (let i = 1; i < toolRequestEvents.length; i += 1) {
      const prev = toolRequestEvents[i - 1];
      const current = toolRequestEvents[i];

      const prevCalls = extractToolCalls(prev);
      const currentCalls = extractToolCalls(current);
      if (prevCalls.length !== 1 || currentCalls.length !== 1) {
        consecutiveIdenticalCalls = 1;
        continue;
      }

      if (toolCallSignature(prevCalls[0]) === toolCallSignature(currentCalls[0])) {
        consecutiveIdenticalCalls += 1;
        if (consecutiveIdenticalCalls >= 3) {
          findings.push({
            stepId: current.stepId,
            dimension: 'retry_loop',
            severity: 'high',
            confidence: 0.98,
            evidence: {
              currentEventId: current.id,
              previousEventId: prev.id,
              repeatedCallSignature: toolCallSignature(currentCalls[0]),
              repeatCount: consecutiveIdenticalCalls,
              issue: 'IDENTICAL_TOOL_CALL_LOOP',
            },
            recommendation: {
              action: 'add_tool_retry_guard',
              detail: 'Stop identical tool call retries after a threshold and route to fallback reasoning.',
            },
          });
        }
      } else {
        consecutiveIdenticalCalls = 1;
      }
    }

    if (maxConsecutiveErrors >= 3) {
      const lastError = [...events].reverse().find((event) => event.eventType === 'error');
      findings.push({
        stepId: lastError?.stepId,
        dimension: 'retry_loop',
        severity: 'high',
        confidence: 1.0,
        evidence: {
          maxConsecutiveErrors,
          issue: 'CONSECUTIVE_ERROR_STREAK',
        },
        recommendation: {
          action: 'add_circuit_breaker',
          detail: 'Introduce backoff/circuit-breaker to avoid repeated failing attempts.',
        },
      });
    }

    const latencies = events.map(extractLatencyMs).filter((value): value is number => value !== undefined);
    if (latencies.length >= 10) {
      const latencyDist = this.buildDistribution(latencies);
      const threshold = latencyDist.p95 * 1.5;
      if (threshold > 0) {
        for (const event of events) {
          const latency = extractLatencyMs(event);
          if (latency !== undefined && latency > threshold) {
            findings.push({
              stepId: event.stepId,
              dimension: 'cost_latency',
              severity: mode === 'deep' ? 'medium' : 'low',
              confidence: 0.95,
              evidence: {
                eventId: event.id,
                latencyMs: latency,
                p95LatencyMs: latencyDist.p95,
                thresholdMs: threshold,
                issue: 'LATENCY_OUTLIER',
              },
              recommendation: {
                action: 'optimize_slow_path',
                detail: 'Review model/tool path for this step to reduce high-latency tail events.',
              },
            });
          }
        }
      }
    }

    const totalTokens = events.map(extractTotalTokens).filter((value): value is number => value !== undefined);
    if (totalTokens.length >= 10) {
      const tokenDist = this.buildDistribution(totalTokens);
      const threshold = tokenDist.p95 * 1.5;
      if (threshold > 0) {
        for (const event of events) {
          const tokens = extractTotalTokens(event);
          if (tokens !== undefined && tokens > threshold) {
            findings.push({
              stepId: event.stepId,
              dimension: 'cost_latency',
              severity: 'low',
              confidence: 0.95,
              evidence: {
                eventId: event.id,
                totalTokens: tokens,
                p95Tokens: tokenDist.p95,
                thresholdTokens: threshold,
                issue: 'TOKEN_OUTLIER',
              },
              recommendation: {
                action: 'reduce_context_or_output',
                detail: 'Trim context/tool verbosity or constrain output length for this step profile.',
              },
            });
          }
        }
      }
    }

    return findings;
  }
}
