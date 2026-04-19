import type { WhyOps } from '@whyops/sdk';

// ─── Constructor options ──────────────────────────────────────────────────────

export interface WhyOpsLangChainTracerOptions {
  /** WhyOps client instance created with `new WhyOps(config)`. */
  whyops: WhyOps;
  /**
   * Stable session / conversation ID.
   * If omitted, falls back to LangChain's root run `trace_id` (or root `id`).
   * Pass an explicit value when you emit additional manual `trace()` events
   * outside of LangChain (e.g. tool latency from a separate service).
   */
  traceId?: string;
  /**
   * Your application's user ID. Attached to every event so you can filter
   * traces by user in the WhyOps dashboard.
   */
  externalUserId?: string;
}

// ─── Resolved LLM output ─────────────────────────────────────────────────────

export interface ResolvedLLMOutput {
  text: string | null;
  toolCalls: Array<{ id?: string; function: { name: string; arguments: string } }>;
  finishReason: string | undefined;
}

// ─── Resolved model identity ─────────────────────────────────────────────────

export interface ModelInfo {
  model: string;
  provider: string;
}
