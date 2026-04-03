import type { WhyOpsTrace } from '@whyops/sdk';

const LOG = '[whyops]';

// ─── Message normalization ────────────────────────────────────────────────────

export interface NormalizedMessage { role: string; content: string }

function toStr(c: unknown): string {
  return typeof c === 'string' ? c : c != null ? JSON.stringify(c) : '';
}

export function extractMessages(options: Record<string, unknown>): NormalizedMessage[] {
  const msgs = options['messages'] as Array<{ role?: unknown; content?: unknown }> | undefined;
  if (msgs?.length) {
    return msgs.map((m) => ({ role: typeof m.role === 'string' ? m.role : 'user', content: toStr(m.content) }));
  }
  if (typeof options['prompt'] === 'string') return [{ role: 'user', content: options['prompt'] }];
  if (Array.isArray(options['prompt'])) {
    return (options['prompt'] as Array<{ role?: unknown; content?: unknown }>)
      .map((m) => ({ role: typeof m.role === 'string' ? m.role : 'user', content: toStr(m.content) }));
  }
  return [];
}

export function extractSystemText(system: unknown): string | undefined {
  if (!system) return undefined;
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return (system as Array<{ content?: unknown }>)
      .map((s) => (typeof s?.content === 'string' ? s.content : ''))
      .filter(Boolean).join('\n') || undefined;
  }
  return typeof (system as { content?: unknown }).content === 'string'
    ? (system as { content: string }).content : undefined;
}

// ─── Usage mapping (v5 + v6 both use inputTokens/outputTokens) ───────────────

function mapUsage(usage: Record<string, unknown>) {
  return {
    promptTokens: usage['inputTokens'] as number | undefined,
    completionTokens: usage['outputTokens'] as number | undefined,
    totalTokens: usage['totalTokens'] as number | undefined,
    // v5: cachedInputTokens  |  v6: inputTokenDetails.cacheReadTokens
    cacheReadTokens: (usage['cachedInputTokens'] ??
      (usage['inputTokenDetails'] as Record<string, unknown> | undefined)?.['cacheReadTokens']) as number | undefined,
    cacheCreationTokens: (usage['inputTokenDetails'] as Record<string, unknown> | undefined)
      ?.['cacheWriteTokens'] as number | undefined,
  };
}

function extractReasoningSignature(reasoning: unknown): string | undefined {
  if (!Array.isArray(reasoning) || reasoning.length === 0) return undefined;

  for (const item of reasoning) {
    const entry = item as Record<string, unknown>;
    const providerMetadata = entry['providerMetadata'] as Record<string, unknown> | undefined;
    if (!providerMetadata) continue;

    const anthropic = providerMetadata['anthropic'] as Record<string, unknown> | undefined;
    const openai = providerMetadata['openai'] as Record<string, unknown> | undefined;
    const direct = providerMetadata['signature'];

    const signature = anthropic?.['signature'] ?? openai?.['signature'] ?? direct;
    if (typeof signature === 'string' && signature.length > 0) return signature;
  }

  return undefined;
}

function extractReasoningText(step: Record<string, unknown>): string | undefined {
  const raw = step['reasoningText'];
  if (typeof raw === 'string' && raw.trim()) return raw;

  const reasoning = step['reasoning'];
  if (!Array.isArray(reasoning) || reasoning.length === 0) return undefined;

  const parts = reasoning
    .map((item) => {
      const text = (item as Record<string, unknown>)['text'];
      return typeof text === 'string' && text.trim() ? text : '';
    })
    .filter(Boolean);

  if (parts.length > 0) return parts.join('\n\n');
  return undefined;
}

// ─── Step event capture (onStepFinish callback) ───────────────────────────────

export async function captureStep(
  trace: WhyOpsTrace,
  step: Record<string, unknown>,
  provider: string,
  modelId: string,
): Promise<void> {
  try {
    const text = step['text'] as string | undefined ?? '';
    const reasoningText = extractReasoningText(step);
    const reasoningSignature = extractReasoningSignature(step['reasoning']);
    const toolCalls = step['toolCalls'] as Array<Record<string, unknown>> | undefined ?? [];
    const toolResults = step['toolResults'] as Array<Record<string, unknown>> | undefined ?? [];
    const finishReason = step['finishReason'] as string | undefined;
    const usage = (step['usage'] as Record<string, unknown> | undefined) ?? {};

    // Map tool calls to WhyOps ToolCallItem format for llmResponse
    const mappedForLLM = toolCalls.length
      ? toolCalls.map((tc) => ({
          id: tc['toolCallId'] as string | undefined,
          function: { name: tc['toolName'] as string, arguments: JSON.stringify(tc['input'] ?? tc['args'] ?? {}) },
        }))
      : undefined;

    // Emit llmThinking if reasoning present
    if (reasoningText) {
      await trace.llmThinking(reasoningText, { signature: reasoningSignature });
    }

    await trace.llmResponse(modelId, provider, text || null, {
      usage: mapUsage(usage),
      finishReason: finishReason ?? undefined,
      ...(mappedForLLM ? { toolCalls: mappedForLLM } : {}),
    });

    // Emit toolCallRequest + toolCallResponse pairs per tool
    for (const tc of toolCalls) {
      const toolName = tc['toolName'] as string;
      const args = (tc['input'] ?? tc['args'] ?? {}) as Record<string, unknown>;
      const toolCallId = tc['toolCallId'] as string;

      // Generate our own spanId — both request + response fire here together
      const spanId = crypto.randomUUID();

      // Emit request with explicit spanId
      await trace.toolCallRequest(toolName, [{ name: toolName, arguments: args }], { spanId });

      // Find matching result
      const result = toolResults.find((r) => r['toolCallId'] === toolCallId);
      if (result) {
        const output = (result['output'] ?? result['result'] ?? {}) as Record<string, unknown>;
        await trace.toolCallResponse(toolName, spanId, [{ name: toolName, arguments: args }], output, {});
      }
    }
  } catch (err) {
    console.error(`${LOG} captureStep error:`, err);
  }
}
