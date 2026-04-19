import { BaseTracer, type Run } from '@langchain/core/tracers/base';
import type { WhyOps, WhyOpsTrace } from '@whyops/sdk';
import type { WhyOpsLangChainTracerOptions } from './types.js';
import {
  LOG,
  extractModelInfo,
  extractMessages,
  extractSystemPrompt,
  extractTokenUsage,
  extractLLMOutput,
  extractToolName,
  parseToolInput,
  normalizeOutput,
} from './utils.js';

// ─── WhyOpsLangChainTracer ────────────────────────────────────────────────────

/**
 * LangChain callback tracer that sends WhyOps observability events in real-time.
 *
 * Extend `BaseTracer` so LangChain manages the run/parent-run hierarchy and
 * delivers a fully-populated `Run` to each hook.
 *
 * @example
 * ```ts
 * import { WhyOpsLangChainTracer } from '@whyops/langchain-js';
 *
 * const tracer = new WhyOpsLangChainTracer({ whyops, traceId: 'session-123' });
 * const result = await chain.invoke(input, { callbacks: [tracer] });
 * ```
 */
export class WhyOpsLangChainTracer extends BaseTracer {
  name = 'whyops_langchain_tracer' as const;

  private readonly whyops: WhyOps;
  private readonly explicitTraceId: string | undefined;
  private readonly externalUserId: string | undefined;

  // runId → spanId: pairs toolCallRequest with toolCallResponse
  private readonly toolSpanIds = new Map<string, string>();
  // runId → pending toolCallRequest promise: ensures request arrives before response
  private readonly toolRequestPromises = new Map<string, Promise<string>>();
  // runId → start timestamp (ms): compute per-run latency
  private readonly llmStartTimes = new Map<string, number>();
  private readonly toolStartTimes = new Map<string, number>();

  constructor(options: WhyOpsLangChainTracerOptions) {
    // _awaitHandler: false → callbacks fire in background, never block user code
    super({ _awaitHandler: false });
    this.whyops = options.whyops;
    this.explicitTraceId = options.traceId;
    this.externalUserId = options.externalUserId;
  }

  // Required by BaseTracer. In per-step mode we send events immediately in
  // each hook, so there is nothing to do when the root trace finishes.
  protected async persistRun(_run: Run): Promise<void> {}

  // ─── Trace ID & trace object ────────────────────────────────────────────────

  private resolveTraceId(run: Run): string {
    // Prefer caller-supplied ID → LangChain's propagated trace_id → root run id
    return this.explicitTraceId ?? run.trace_id ?? run.id;
  }

  private getTrace(run: Run): WhyOpsTrace {
    return this.whyops.trace(this.resolveTraceId(run));
  }

  // ─── LLM / Chat model hooks ─────────────────────────────────────────────────

  override async onLLMStart(run: Run): Promise<void> {
    this.llmStartTimes.set(run.id, Date.now());

    // extractMessages returns null when this is a tool-result continuation round.
    // Only emit user_message on the initial human turn.
    const messages = extractMessages(run);
    if (!messages) return;

    const systemPrompt = extractSystemPrompt(run);
    const trace = this.getTrace(run);

    void trace.userMessage(messages, {
      ...(systemPrompt ? { metadata: { systemPrompt } } : {}),
      ...(this.externalUserId ? { externalUserId: this.externalUserId } : {}),
    });
  }

  override async onLLMEnd(run: Run): Promise<void> {
    const startTime = this.llmStartTimes.get(run.id);
    this.llmStartTimes.delete(run.id);
    const latencyMs = startTime !== undefined ? Date.now() - startTime : undefined;

    const { model, provider } = extractModelInfo(run);
    const { text, toolCalls, finishReason } = extractLLMOutput(run);
    const usage = extractTokenUsage(run);
    const trace = this.getTrace(run);

    void trace.llmResponse(model, provider, text, {
      usage,
      finishReason,
      ...(toolCalls.length ? { toolCalls } : {}),
      ...(latencyMs !== undefined ? { latencyMs } : {}),
      ...(this.externalUserId ? { externalUserId: this.externalUserId } : {}),
    });
  }

  override async onLLMError(run: Run): Promise<void> {
    this.llmStartTimes.delete(run.id);
    const msg = run.error ?? 'LLM error';
    void this.getTrace(run).error(msg, {
      ...(this.externalUserId ? { externalUserId: this.externalUserId } : {}),
    });
  }

  // ─── Tool hooks ─────────────────────────────────────────────────────────────

  override async onToolStart(run: Run): Promise<void> {
    this.toolStartTimes.set(run.id, Date.now());

    const toolName = extractToolName(run);
    const inputs = run.inputs as Record<string, unknown> | undefined;
    const args = parseToolInput(inputs?.['input']);
    const spanId = crypto.randomUUID();
    this.toolSpanIds.set(run.id, spanId);
    const trace = this.getTrace(run);

    // Store the promise so onToolEnd can await it before sending the response.
    // This guarantees tool_call_request always arrives at the server before
    // tool_call_response, even when multiple tools run in parallel.
    const requestPromise = trace.toolCallRequest(
      toolName,
      [{ name: toolName, arguments: args }],
      {
        spanId,
        ...(this.externalUserId ? { externalUserId: this.externalUserId } : {}),
      },
    );
    this.toolRequestPromises.set(run.id, requestPromise);
  }

  override async onToolEnd(run: Run): Promise<void> {
    const spanId = this.toolSpanIds.get(run.id) ?? crypto.randomUUID();
    this.toolSpanIds.delete(run.id);
    const startTime = this.toolStartTimes.get(run.id);
    this.toolStartTimes.delete(run.id);
    const latencyMs = startTime !== undefined ? Date.now() - startTime : undefined;

    // Wait for the request event to be fully sent before sending the response.
    // Prevents race conditions where the response arrives at the server first.
    const requestPromise = this.toolRequestPromises.get(run.id);
    this.toolRequestPromises.delete(run.id);
    if (requestPromise) await requestPromise;

    const toolName = extractToolName(run);
    const inputs = run.inputs as Record<string, unknown> | undefined;
    const args = parseToolInput(inputs?.['input']);
    const output = normalizeOutput(run.outputs);
    const trace = this.getTrace(run);

    void trace.toolCallResponse(
      toolName,
      spanId,
      [{ name: toolName, arguments: args }],
      output,
      {
        ...(latencyMs !== undefined ? { latencyMs } : {}),
        ...(this.externalUserId ? { externalUserId: this.externalUserId } : {}),
      },
    );
  }

  override async onToolError(run: Run): Promise<void> {
    this.toolSpanIds.delete(run.id);
    this.toolStartTimes.delete(run.id);
    this.toolRequestPromises.delete(run.id);
    const toolName = extractToolName(run);
    const msg = run.error ?? `Tool ${toolName} error`;
    void this.getTrace(run).error(msg, {
      ...(this.externalUserId ? { externalUserId: this.externalUserId } : {}),
    });
  }

  // ─── Chain hooks ─────────────────────────────────────────────────────────────

  override async onChainError(run: Run): Promise<void> {
    const msg = run.error ?? 'Chain error';
    void this.getTrace(run).error(msg, {
      ...(this.externalUserId ? { externalUserId: this.externalUserId } : {}),
    });
  }

  // ─── Retriever hooks (no-op — not mapped to WhyOps events) ──────────────────

  override async onRetrieverStart(_run: Run): Promise<void> {}
  override async onRetrieverEnd(_run: Run): Promise<void> {}
  override async onRetrieverError(run: Run): Promise<void> {
    console.warn(`${LOG} retriever error in run ${run.id}:`, run.error);
  }
}
