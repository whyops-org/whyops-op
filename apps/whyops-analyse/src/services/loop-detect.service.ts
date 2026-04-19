import { parseUniversal } from './universal-parser.service';
import { getJudgeModel } from '../langchain';
import { createServiceLogger } from '@whyops/shared/logger';
import type { NormalizedEvent } from './format-heuristics';

const logger = createServiceLogger('analyse:loop-detect');

export interface LoopEntry {
  tool: string;
  params: unknown;
  count: number;
  runIndices: number[];
}

export interface ErrorPattern {
  pattern: string;
  count: number;
  runIndices: number[];
}

export interface LoopDetectionResult {
  loops: LoopEntry[];
  errorPatterns: ErrorPattern[];
  totalToolCalls: number;
  loopedCallCount: number;
  detectedFormats: string[];
  detectionMethods: string[];
}

export interface RootCauseResult {
  rootCause: string;
  fix: string;
  confidence: 'high' | 'medium' | 'low';
}

function hashParams(params: unknown): string {
  const str = typeof params === 'object' && params !== null
    ? JSON.stringify(params, Object.keys(params as object).sort())
    : JSON.stringify(params);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return h.toString(16);
}

export async function detectLoops(rawRuns: unknown[]): Promise<LoopDetectionResult> {
  const toolCallMap = new Map<string, LoopEntry>();
  const errorMap = new Map<string, ErrorPattern>();
  let totalToolCalls = 0;
  const detectedFormats: string[] = [];
  const detectionMethods: string[] = [];

  for (let runIdx = 0; runIdx < rawRuns.length; runIdx++) {
    const parsed = await parseUniversal(rawRuns[runIdx], 'events');
    detectedFormats.push(parsed.format);
    detectionMethods.push(parsed.detectionMethod);

    for (const event of parsed.events as NormalizedEvent[]) {
      if (event.eventType === 'tool_call') {
        totalToolCalls++;
        const toolName = event.metadata?.tool ?? 'unknown';
        const params = typeof event.content === 'object' && event.content !== null
          ? (event.content as Record<string, unknown>).input ?? (event.content as Record<string, unknown>).params ?? event.content
          : event.content;
        const ph = hashParams(params);
        const key = `${toolName}::${ph}`;
        const existing = toolCallMap.get(key);
        if (existing) {
          existing.count++;
          if (!existing.runIndices.includes(runIdx)) existing.runIndices.push(runIdx);
        } else {
          toolCallMap.set(key, { tool: toolName, params, count: 1, runIndices: [runIdx] });
        }
      }

      if (event.eventType === 'error') {
        const errStr = (typeof event.content === 'string' ? event.content : JSON.stringify(event.content)).slice(0, 120);
        const existing = errorMap.get(errStr);
        if (existing) {
          existing.count++;
          if (!existing.runIndices.includes(runIdx)) existing.runIndices.push(runIdx);
        } else {
          errorMap.set(errStr, { pattern: errStr, count: 1, runIndices: [runIdx] });
        }
      }
    }
  }

  const loops = Array.from(toolCallMap.values()).filter((e) => e.count >= 2).sort((a, b) => b.count - a.count);
  const errorPatterns = Array.from(errorMap.values()).filter((e) => e.count >= 2).sort((a, b) => b.count - a.count);
  const loopedCallCount = loops.reduce((s, l) => s + l.count, 0);

  return { loops, errorPatterns, totalToolCalls, loopedCallCount, detectedFormats, detectionMethods };
}

export async function getRootCause(loops: LoopEntry[], errorPatterns: ErrorPattern[]): Promise<RootCauseResult> {
  const loopSummary = loops.map((l) => `- "${l.tool}" called ${l.count}× with params: ${JSON.stringify(l.params).slice(0, 200)}`).join('\n');
  const errSummary = errorPatterns.map((e) => `- Error ${e.count}×: "${e.pattern.slice(0, 150)}"`).join('\n');

  const prompt = `You are an AI agent debugging expert. Analyze loop patterns and give a concise root cause and fix.

Loops:
${loopSummary || '(none)'}
Recurring errors:
${errSummary || '(none)'}

Respond ONLY with JSON:
{"rootCause":"one sentence why","fix":"one sentence fix","confidence":"high"|"medium"|"low"}`;

  try {
    const model = getJudgeModel();
    const response = await model.invoke(prompt);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    const r = JSON.parse(match[0]) as RootCauseResult;
    if (!r.rootCause || !r.fix || !r.confidence) throw new Error('Incomplete');
    return r;
  } catch (err) {
    logger.warn({ err }, 'Root cause LLM failed');
    return { rootCause: 'Could not determine root cause.', fix: 'Ensure tool outputs include actionable error details.', confidence: 'low' };
  }
}
