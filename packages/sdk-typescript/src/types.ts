import type { EVENT_TYPES } from './config.generated.js';

// ─── Event types ──────────────────────────────────────────────────────────────

export type EventType = typeof EVENT_TYPES[number];

// ─── Content shapes (per event type) ─────────────────────────────────────────

export interface MessageItem {
  role: string;
  content: string;
}

export interface ToolCallItem {
  id?: string;
  function: {
    name: string;
    /** JSON-encoded arguments string */
    arguments: string;
  };
}

export interface UserMessageContent {
  messages: MessageItem[];
}

export interface LLMResponseContent {
  content?: string | null;
  toolCalls?: ToolCallItem[];
  finishReason?: 'stop' | 'tool_calls' | 'max_tokens' | 'error' | string;
}

export interface LLMThinkingContent {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface EmbeddingRequestContent {
  input: string[];
}

export interface EmbeddingResponseContent {
  object: 'list';
  embeddingCount: number;
  firstEmbeddingDimensions: number;
  encodingFormat: 'float' | 'base64';
}

export interface ToolCallPair {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallRequestContent {
  toolCalls: ToolCallPair[];
  requestedAt?: string;
}

export interface ToolCallResponseContent {
  toolCalls: ToolCallPair[];
  toolResults: Record<string, unknown>;
  respondedAt?: string;
}

export interface ToolResultContent {
  toolName: string;
  output: Record<string, unknown>;
}

export interface ErrorContent {
  message: string;
  status?: number;
  stack?: string;
}

// ─── Metadata shapes (per event type) ────────────────────────────────────────

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export interface LLMResponseMetadata {
  /** Required. e.g. "openai/gpt-4o" */
  model: string;
  /** Required. e.g. "openai" */
  provider: string;
  usage?: TokenUsage;
  latencyMs?: number;
}

export interface EmbeddingResponseMetadata {
  /** Required. */
  model: string;
  /** Required. */
  provider: string;
  usage?: { totalTokens?: number };
  latencyMs?: number;
}

export interface ToolCallMetadata {
  /** Required. Tool name. */
  tool: string;
  latencyMs?: number;
}

export interface UserMessageMetadata {
  systemPrompt?: string;
  tools?: Array<{ name: string }>;
  params?: Record<string, unknown>;
}

// ─── Shared event base ────────────────────────────────────────────────────────

export interface EventBase {
  /** Auto-set by WhyOpsTrace. */
  traceId?: string;
  /** Auto-set by WhyOpsTrace. */
  agentName?: string;
  /**
   * Shared ID for a request+response pair. Auto-generated if omitted.
   * Pass the same spanId to toolCallRequest and toolCallResponse.
   */
  spanId?: string;
  /** Auto-incremented by backend if omitted. */
  stepId?: number;
  /** Auto-resolved by backend if omitted. */
  parentStepId?: number;
  /** ISO 8601. Defaults to server time if omitted. */
  timestamp?: string;
  /** For retry safety. */
  idempotencyKey?: string;
}

// ─── Per-method option bags ───────────────────────────────────────────────────

export interface UserMessageOptions extends EventBase {
  metadata?: UserMessageMetadata;
}

export interface LLMResponseOptions extends EventBase {
  usage?: TokenUsage;
  latencyMs?: number;
  finishReason?: string;
  toolCalls?: ToolCallItem[];
}

export interface LLMThinkingOptions extends EventBase {
  signature?: string;
}

export interface EmbeddingRequestOptions extends EventBase {}

export interface EmbeddingResponseOptions extends EventBase {
  latencyMs?: number;
  totalTokens?: number;
}

export interface ToolCallRequestOptions extends EventBase {
  requestedAt?: string;
  latencyMs?: number;
}

export interface ToolCallResponseOptions extends EventBase {
  respondedAt?: string;
  latencyMs?: number;
}

export interface ToolResultOptions extends EventBase {}

export interface ErrorOptions extends EventBase {
  status?: number;
  stack?: string;
}

// ─── Agent types ──────────────────────────────────────────────────────────────

export interface AgentTool {
  name: string;
  description?: string;
  /** JSON string (not object). Use JSON.stringify() on your schema. */
  inputSchema?: string;
  /** JSON string (not object). */
  outputSchema?: string;
}

export interface AgentMetadata {
  systemPrompt: string;
  description?: string;
  tools?: AgentTool[];
}

export interface AgentInfo {
  agentId: string;
  agentVersionId: string;
  status: 'created' | 'existing';
  versionHash: string;
}

// ─── Client config ────────────────────────────────────────────────────────────

export interface WhyOpsConfig {
  apiKey: string;
  agentName: string;
  agentMetadata: AgentMetadata;
  /**
   * Optional. Defaults to https://proxy.whyops.com (from packages/sdk/config.json).
   * Only set this if you're self-hosting the WhyOps proxy.
   */
  proxyBaseUrl?: string;
  /**
   * Optional. Defaults to https://a.whyops.com/api (from packages/sdk/config.json).
   * Only set this if you're self-hosting the WhyOps analyse service.
   */
  analyseBaseUrl?: string;
}

// ─── Internal event payload (sent to API) ─────────────────────────────────────

export interface EventPayload {
  eventType: EventType;
  traceId: string;
  agentName: string;
  spanId?: string;
  stepId?: number;
  parentStepId?: number;
  timestamp?: string;
  content?: unknown;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}
