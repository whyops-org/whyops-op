import type { Run } from '@langchain/core/tracers/base';
import type { ModelInfo, ResolvedLLMOutput } from './types.js';
import type { TokenUsage } from '@whyops/sdk';

const LOG = '[whyops]';

// ─── Provider class-name → provider string ────────────────────────────────────

const CLASS_TO_PROVIDER: Record<string, string> = {
  ChatOpenAI: 'openai',
  OpenAI: 'openai',
  AzureChatOpenAI: 'azure_openai',
  ChatAnthropic: 'anthropic',
  Anthropic: 'anthropic',
  ChatGoogleGenerativeAI: 'google',
  ChatVertexAI: 'google',
  ChatMistralAI: 'mistral',
  MistralAI: 'mistral',
  ChatOllama: 'ollama',
  OllamaLLM: 'ollama',
  ChatBedrock: 'bedrock',
  BedrockChat: 'bedrock',
  ChatCohere: 'cohere',
  Cohere: 'cohere',
  ChatFireworks: 'fireworks',
  ChatGroq: 'groq',
  ChatTogether: 'together',
};

// ─── Model identity extraction ────────────────────────────────────────────────

export function extractModelInfo(run: Run): ModelInfo {
  const serializedId = (run.serialized as Record<string, unknown>)?.['id'];
  const className = Array.isArray(serializedId)
    ? (serializedId[serializedId.length - 1] as string | undefined) ?? 'unknown'
    : 'unknown';

  const provider = CLASS_TO_PROVIDER[className] ?? 'unknown';

  const extra = run.extra as Record<string, unknown> | undefined;
  const metadata = extra?.['metadata'] as Record<string, unknown> | undefined;
  const kwargs = extra?.['kwargs'] as Record<string, unknown> | undefined;

  const model =
    (metadata?.['ls_model_name'] as string | undefined) ??
    (kwargs?.['model_name'] as string | undefined) ??
    (kwargs?.['model'] as string | undefined) ??
    run.name ??
    className;

  return { model, provider };
}

// ─── Message extraction from LLM run inputs ───────────────────────────────────

function toStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v != null) return JSON.stringify(v);
  return '';
}

export interface NormalizedMessage {
  role: string;
  content: string;
}

/**
 * Extracts the user-facing messages from an LLM run's inputs.
 *
 * Returns null when this is a tool-result continuation round (i.e. the message
 * list already contains AI or tool messages), so the caller knows to skip
 * emitting a `user_message` event — only the initial human turn should fire it.
 *
 * System messages are excluded from the returned array; they belong in
 * `metadata.systemPrompt` only.
 */
export function extractMessages(run: Run): NormalizedMessage[] | null {
  const inputs = run.inputs as Record<string, unknown> | undefined;
  if (!inputs) return null;

  // Chat model: inputs.messages is BaseMessage[][]
  const msgs = inputs['messages'];
  if (Array.isArray(msgs)) {
    const batch = msgs[0];
    if (Array.isArray(batch)) {
      const messages = batch as Array<Record<string, unknown>>;

      // If the batch contains any AI or tool messages this is a tool-result
      // continuation round — not a fresh user turn. Skip user_message.
      const hasAIOrTool = messages.some((m) => {
        const t = (m['type'] as string | undefined) ?? '';
        return t === 'ai' || t === 'tool';
      });
      if (hasAIOrTool) return null;

      // Only return human messages (system is captured in metadata separately)
      const human = messages
        .filter((m) => (m['type'] as string | undefined) === 'human')
        .map((m) => ({ role: 'user' as const, content: toStr(m['content']) }));

      return human.length > 0 ? human : null;
    }
  }

  // Raw LLM: inputs.prompts is string[]
  const prompts = inputs['prompts'];
  if (Array.isArray(prompts) && prompts.length > 0) {
    return [{ role: 'user', content: toStr(prompts[0]) }];
  }

  return null;
}

export function extractSystemPrompt(run: Run): string | undefined {
  const inputs = run.inputs as Record<string, unknown> | undefined;
  if (!inputs) return undefined;

  const msgs = inputs['messages'];
  if (Array.isArray(msgs)) {
    const batch = msgs[0];
    if (Array.isArray(batch)) {
      const sysMsg = (batch as Array<Record<string, unknown>>).find(
        (m) => (m['type'] as string | undefined) === 'system',
      );
      if (sysMsg) return toStr(sysMsg['content']);
    }
  }

  const extra = run.extra as Record<string, unknown> | undefined;
  const metadata = extra?.['metadata'] as Record<string, unknown> | undefined;
  return metadata?.['ls_system_prompt'] as string | undefined;
}

// ─── Token usage extraction ───────────────────────────────────────────────────

export function extractTokenUsage(run: Run): TokenUsage {
  const outputs = run.outputs as Record<string, unknown> | undefined;
  if (!outputs) return {};

  // Priority 1: OpenAI-style llmOutput.tokenUsage
  const llmOutput = outputs['llmOutput'] as Record<string, unknown> | undefined;
  const tokenUsage = llmOutput?.['tokenUsage'] as Record<string, unknown> | undefined;
  if (tokenUsage) {
    return {
      promptTokens: tokenUsage['promptTokens'] as number | undefined,
      completionTokens: tokenUsage['completionTokens'] as number | undefined,
      totalTokens: tokenUsage['totalTokens'] as number | undefined,
    };
  }

  // Priority 2: Standardized usage_metadata on the first AIMessage
  const generations = outputs['generations'] as Array<Array<Record<string, unknown>>> | undefined;
  const firstGen = generations?.[0]?.[0];
  if (firstGen) {
    const message = firstGen['message'] as Record<string, unknown> | undefined;
    const usage = message?.['usage_metadata'] as Record<string, unknown> | undefined;
    if (usage) {
      const inDetails = usage['input_token_details'] as Record<string, unknown> | undefined;
      return {
        promptTokens: usage['input_tokens'] as number | undefined,
        completionTokens: usage['output_tokens'] as number | undefined,
        totalTokens: usage['total_tokens'] as number | undefined,
        cacheReadTokens: inDetails?.['cache_read'] as number | undefined,
        cacheCreationTokens: inDetails?.['cache_creation'] as number | undefined,
      };
    }
  }

  return {};
}

// ─── LLM output extraction ────────────────────────────────────────────────────

export function extractLLMOutput(run: Run): ResolvedLLMOutput {
  const outputs = run.outputs as Record<string, unknown> | undefined;
  const generations = outputs?.['generations'] as Array<Array<Record<string, unknown>>> | undefined;
  const firstGen = generations?.[0]?.[0];

  if (!firstGen) {
    return { text: null, toolCalls: [], finishReason: undefined };
  }

  // Extract text
  const text = (firstGen['text'] as string | undefined) || null;

  // Extract finish reason
  const genInfo = firstGen['generationInfo'] as Record<string, unknown> | undefined;
  const finishReason = (genInfo?.['finish_reason'] as string | undefined)
    ?? (genInfo?.['finishReason'] as string | undefined);

  // Extract tool calls from AIMessage additional_kwargs or tool_calls field
  const message = firstGen['message'] as Record<string, unknown> | undefined;
  const additionalKwargs = message?.['additional_kwargs'] as Record<string, unknown> | undefined;
  const rawToolCalls = (message?.['tool_calls'] as Array<Record<string, unknown>> | undefined)
    ?? (additionalKwargs?.['tool_calls'] as Array<Record<string, unknown>> | undefined)
    ?? [];

  const toolCalls = rawToolCalls.map((tc) => {
    const fn = tc['function'] as Record<string, unknown> | undefined;
    return {
      id: tc['id'] as string | undefined,
      function: {
        name: (fn?.['name'] ?? tc['name'] ?? '') as string,
        arguments: typeof fn?.['arguments'] === 'string'
          ? fn['arguments']
          : JSON.stringify(tc['args'] ?? fn?.['arguments'] ?? {}),
      },
    };
  });

  return { text, toolCalls, finishReason };
}

// ─── Tool helpers ─────────────────────────────────────────────────────────────

export function extractToolName(run: Run): string {
  const serializedId = (run.serialized as Record<string, unknown>)?.['id'];
  const last = Array.isArray(serializedId)
    ? (serializedId[serializedId.length - 1] as string | undefined)
    : undefined;
  return run.name ?? last ?? 'unknown_tool';
}

export function parseToolInput(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { /* fall through */ }
    return { input: raw };
  }
  return { input: raw };
}

export function normalizeOutput(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return { output: raw };
}

export { LOG };
