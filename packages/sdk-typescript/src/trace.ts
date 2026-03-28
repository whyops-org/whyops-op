import { ENDPOINTS, LOG_PREFIX } from './config.js';
import { post } from './http.js';
import type {
  ErrorOptions,
  EventBase,
  EventPayload,
  EventType,
  LLMResponseOptions,
  LLMThinkingOptions,
  MessageItem,
  EmbeddingRequestOptions,
  EmbeddingResponseOptions,
  ToolCallPair,
  ToolCallRequestOptions,
  ToolCallResponseOptions,
  ToolResultOptions,
  UserMessageOptions,
} from './types.js';

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class WhyOpsTrace {
  constructor(
    private readonly traceId: string,
    private readonly agentName: string,
    private readonly apiKey: string,
    private readonly analyseBaseUrl: string,
    private readonly onInit: () => Promise<void>,
  ) {}

  // ─── user_message ────────────────────────────────────────────────────────

  async userMessage(messages: MessageItem[], options: UserMessageOptions = {}): Promise<void> {
    const meta: Record<string, unknown> | undefined = options.metadata
      ? { ...options.metadata }
      : undefined;
    await this.send(this.buildPayload('user_message', { messages }, meta, options));
  }

  // ─── llm_response ────────────────────────────────────────────────────────

  async llmResponse(
    model: string,
    provider: string,
    content: string | null | undefined,
    options: LLMResponseOptions = {},
  ): Promise<void> {
    const meta: Record<string, unknown> = { model, provider };
    if (options.usage) meta['usage'] = options.usage;
    if (options.latencyMs !== undefined) meta['latencyMs'] = options.latencyMs;

    const eventContent: Record<string, unknown> = {};
    if (content != null) eventContent['content'] = content;
    if (options.toolCalls?.length) eventContent['toolCalls'] = options.toolCalls;
    if (options.finishReason) eventContent['finishReason'] = options.finishReason;

    await this.send(this.buildPayload('llm_response', eventContent, meta, options));
  }

  // ─── llm_thinking ────────────────────────────────────────────────────────

  async llmThinking(thinking: string, options: LLMThinkingOptions = {}): Promise<void> {
    const c: Record<string, unknown> = { type: 'thinking', thinking };
    if (options.signature) c['signature'] = options.signature;
    await this.send(this.buildPayload('llm_thinking', c, undefined, options));
  }

  // ─── embedding_request ───────────────────────────────────────────────────

  async embeddingRequest(inputs: string[], options: EmbeddingRequestOptions = {}): Promise<void> {
    await this.send(this.buildPayload('embedding_request', { input: inputs }, undefined, options));
  }

  // ─── embedding_response ──────────────────────────────────────────────────

  async embeddingResponse(
    model: string,
    provider: string,
    embeddingCount: number,
    firstEmbeddingDimensions: number,
    options: EmbeddingResponseOptions = {},
  ): Promise<void> {
    const meta: Record<string, unknown> = { model, provider };
    if (options.totalTokens !== undefined) meta['usage'] = { totalTokens: options.totalTokens };
    if (options.latencyMs !== undefined) meta['latencyMs'] = options.latencyMs;

    await this.send(this.buildPayload(
      'embedding_response',
      { object: 'list', embeddingCount, firstEmbeddingDimensions, encodingFormat: 'float' },
      meta,
      options,
    ));
  }

  // ─── tool_call_request ───────────────────────────────────────────────────

  /**
   * Emit a tool_call_request event.
   * Returns the spanId — pass it to `toolCallResponse` to pair them.
   */
  async toolCallRequest(
    tool: string,
    toolCalls: ToolCallPair[],
    options: ToolCallRequestOptions = {},
  ): Promise<string> {
    const spanId = options.spanId ?? uuid();
    const c: Record<string, unknown> = { toolCalls };
    if (options.requestedAt) c['requestedAt'] = options.requestedAt;
    const meta: Record<string, unknown> = { tool };
    if (options.latencyMs !== undefined) meta['latencyMs'] = options.latencyMs;

    await this.send(this.buildPayload('tool_call_request', c, meta, { ...options, spanId }));
    return spanId;
  }

  // ─── tool_call_response ──────────────────────────────────────────────────

  async toolCallResponse(
    tool: string,
    spanId: string,
    toolCalls: ToolCallPair[],
    toolResults: Record<string, unknown>,
    options: ToolCallResponseOptions = {},
  ): Promise<void> {
    const c: Record<string, unknown> = { toolCalls, toolResults };
    if (options.respondedAt) c['respondedAt'] = options.respondedAt;
    const meta: Record<string, unknown> = { tool };
    if (options.latencyMs !== undefined) meta['latencyMs'] = options.latencyMs;

    await this.send(this.buildPayload('tool_call_response', c, meta, { ...options, spanId }));
  }

  // ─── tool_result ─────────────────────────────────────────────────────────

  async toolResult(
    toolName: string,
    output: Record<string, unknown>,
    options: ToolResultOptions = {},
  ): Promise<void> {
    await this.send(this.buildPayload('tool_result', { toolName, output }, undefined, options));
  }

  // ─── error ───────────────────────────────────────────────────────────────

  async error(message: string, options: ErrorOptions = {}): Promise<void> {
    const c: Record<string, unknown> = { message };
    if (options.status !== undefined) c['status'] = options.status;
    if (options.stack) c['stack'] = options.stack;
    await this.send(this.buildPayload('error', c, undefined, options));
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private buildPayload(
    eventType: EventType,
    content: unknown,
    metadata: Record<string, unknown> | undefined,
    opts: EventBase,
  ): EventPayload {
    const payload: EventPayload = {
      eventType,
      traceId: this.traceId,
      agentName: this.agentName,
      content,
    };
    if (opts.spanId) payload.spanId = opts.spanId;
    if (opts.stepId) payload.stepId = opts.stepId;
    if (opts.parentStepId) payload.parentStepId = opts.parentStepId;
    if (opts.timestamp) payload.timestamp = opts.timestamp;
    if (opts.idempotencyKey) payload.idempotencyKey = opts.idempotencyKey;
    if (metadata) payload.metadata = metadata;
    return payload;
  }

  private async send(payload: EventPayload): Promise<void> {
    await this.onInit();
    try {
      const res = await post(
        `${this.analyseBaseUrl}${ENDPOINTS.eventsIngest}`,
        payload,
        { Authorization: `Bearer ${this.apiKey}` },
      );
      if (!res.ok) {
        console.error(`${LOG_PREFIX} event send failed: HTTP ${res.status}`, payload.eventType);
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} event send error:`, err);
    }
  }
}
