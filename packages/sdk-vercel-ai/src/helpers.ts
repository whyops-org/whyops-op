import { embed as _embed, embedMany as _embedMany, stepCountIs } from 'ai';
import type { WhyOps } from '@whyops/sdk';
import { wrapModelForReasoning } from './model.js';
import { extractMessages, extractSystemText, captureStep } from './types.js';

const LOG = '[whyops]';

// ─── Module state ─────────────────────────────────────────────────────────────

let _whyops: WhyOps | null = null;

function normalizeStopWhen(options: Record<string, unknown>): Record<string, unknown> {
  const maxSteps = options['maxSteps'];
  const stopWhen = options['stopWhen'];

  if (stopWhen !== undefined || typeof maxSteps !== 'number' || !Number.isFinite(maxSteps)) {
    return options;
  }

  return {
    ...options,
    // ai@5 multi-step continuation is controlled by stopWhen.
    stopWhen: stepCountIs(Math.max(1, Math.trunc(maxSteps))),
  };
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Register a WhyOps client instance. Call once at startup.
 */
export function registerWhyOps(whyops: WhyOps): void {
  _whyops = whyops;
}

// ─── withWhyOps ──────────────────────────────────────────────────────────────

/**
 * Injects WhyOps observability into generateText / streamText options.
 * Compatible with ai >= 5.0.0. Captures userMessage, llmResponse,
 * toolCallRequest/Response, llmThinking automatically.
 *
 * @example
 * const result = await generateText(withWhyOps({ model, prompt: 'hello' }));
 */
export function withWhyOps<T extends object>(options: T): T {
  if (!_whyops) {
    console.warn(`${LOG} registerWhyOps() must be called before withWhyOps()`);
    return options;
  }

  const normalized = normalizeStopWhen(options as Record<string, unknown>);
  const inputModel = normalized['model'];
  const model = inputModel && typeof inputModel === 'object'
    ? wrapModelForReasoning(inputModel)
    : inputModel;

  const traceId = crypto.randomUUID();
  const trace = _whyops.trace(traceId);

  // Extract model info from the original provider model. Wrappers may not
  // preserve non-enumerable provider metadata.
  const modelObj = inputModel as Record<string, unknown> | undefined;
  const provider = modelObj?.['provider'] as string ?? 'unknown';
  const modelId = modelObj?.['modelId'] as string ?? 'unknown';

  // Fire-and-forget userMessage from options (sync extraction, async send)
  const messages = extractMessages(normalized);
  const systemPrompt = extractSystemText(normalized['system']);
  const toolKeys = normalized['tools'];
  const toolNames = toolKeys && typeof toolKeys === 'object'
    ? Object.keys(toolKeys).map((name) => ({ name }))
    : undefined;

  const userMessagePromise = messages.length
    ? trace.userMessage(messages, {
      metadata: {
        ...(systemPrompt ? { systemPrompt } : {}),
        ...(toolNames?.length ? { tools: toolNames } : {}),
        params: { model: modelId },
      },
    })
    : Promise.resolve();

  const userOnStepFinish = normalized['onStepFinish'] as
    ((step: unknown) => unknown) | undefined;
  const userOnError = normalized['onError'] as
    ((err: unknown) => unknown) | undefined;

  return {
    ...normalized,
    model,
    onStepFinish: async (step: unknown) => {
      await userMessagePromise;
      await captureStep(trace, step as Record<string, unknown>, provider, modelId);
      await userOnStepFinish?.(step);
    },
    onError: async (err: unknown) => {
      await userMessagePromise;
      // streamText passes { error } object; generateText just throws
      const raw = (err as Record<string, unknown>)?.['error'] ?? err;
      const msg = raw instanceof Error ? raw.message : String(raw ?? 'unknown error');
      const stack = raw instanceof Error ? raw.stack : undefined;
      void trace.error(msg, { stack });
      await userOnError?.(err);
    },
  } as T;
}

// ─── embed wrapper ────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for ai's `embed`. Captures embedding events in WhyOps.
 * Compatible with ai >= 5.0.0.
 */
export async function embed(
  options: Parameters<typeof _embed>[0],
): ReturnType<typeof _embed> {
  if (!_whyops) return _embed(options);

  const traceId = crypto.randomUUID();
  const trace = _whyops.trace(traceId);
  const modelObj = (options as Record<string, unknown>)['model'] as Record<string, unknown> | undefined;
  const provider = modelObj?.['provider'] as string ?? 'unknown';
  const modelId = modelObj?.['modelId'] as string ?? 'unknown';
  const value = (options as Record<string, unknown>)['value'];
  const inputs = typeof value === 'string' ? [value] : [];

  void trace.embeddingRequest(inputs);

  try {
    const result = await _embed(options);
    const r = result as unknown as Record<string, unknown>;
    const emb = r['embedding'] as number[] | undefined;
    const usage = r['usage'] as { tokens?: number } | undefined;

    void trace.embeddingResponse(modelId, provider, 1, emb?.length ?? 0, { totalTokens: usage?.tokens });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? 'embedding error');
    const stack = err instanceof Error ? err.stack : undefined;
    void trace.error(msg, { stack });
    throw err;
  }
}

// ─── embedMany wrapper ────────────────────────────────────────────────────────

/**
 * Drop-in replacement for ai's `embedMany`. Captures embedding events in WhyOps.
 * Compatible with ai >= 5.0.0.
 */
export async function embedMany(
  options: Parameters<typeof _embedMany>[0],
): ReturnType<typeof _embedMany> {
  if (!_whyops) return _embedMany(options);

  const traceId = crypto.randomUUID();
  const trace = _whyops.trace(traceId);
  const modelObj = (options as Record<string, unknown>)['model'] as Record<string, unknown> | undefined;
  const provider = modelObj?.['provider'] as string ?? 'unknown';
  const modelId = modelObj?.['modelId'] as string ?? 'unknown';
  const values = (options as Record<string, unknown>)['values'] as string[] | undefined ?? [];

  void trace.embeddingRequest(values);

  try {
    const result = await _embedMany(options);
    const r = result as unknown as Record<string, unknown>;
    const embeddings = r['embeddings'] as number[][] | undefined ?? [];
    const usage = r['usage'] as { tokens?: number } | undefined;
    const firstDims = embeddings[0]?.length ?? 0;

    void trace.embeddingResponse(modelId, provider, embeddings.length, firstDims, { totalTokens: usage?.tokens });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? 'embedding error');
    const stack = err instanceof Error ? err.stack : undefined;
    void trace.error(msg, { stack });
    throw err;
  }
}
