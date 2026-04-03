type AnyRecord = Record<string, unknown>;

const WRAPPED_MODELS = new WeakMap<object, object>();

function asRecord(value: unknown): AnyRecord | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'object' && parsed != null ? parsed as AnyRecord : undefined;
    } catch {
      return undefined;
    }
  }
  return typeof value === 'object' ? value as AnyRecord : undefined;
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (!Array.isArray(value)) return undefined;

  const parts = value
    .map((item) => typeof item === 'string' ? item : '')
    .filter(Boolean);

  return parts.length > 0 ? parts.join('') : undefined;
}

function getChoice(raw: unknown): AnyRecord | undefined {
  const body = asRecord(raw);
  const choices = body?.['choices'];
  return Array.isArray(choices) ? asRecord(choices[0]) : undefined;
}

function getResponseReasoning(raw: unknown): string | undefined {
  const message = asRecord(getChoice(raw)?.['message']);
  return asText(message?.['reasoning_content']);
}

function getGenerateReasoning(result: unknown): string | undefined {
  const response = asRecord((result as AnyRecord | undefined)?.['response']);
  return getResponseReasoning(response?.['body']) ?? getResponseReasoning(response);
}

function getChunkReasoning(raw: unknown): string | undefined {
  const delta = asRecord(getChoice(raw)?.['delta']);
  return asText(delta?.['reasoning_content']);
}

function closesReasoning(type: unknown): boolean {
  return typeof type === 'string'
    && type !== 'raw'
    && type !== 'stream-start'
    && type !== 'response-metadata'
    && !type.startsWith('reasoning-');
}

export function wrapModelForReasoning<T extends object>(model: T): T {
  const hit = WRAPPED_MODELS.get(model);
  if (hit) return hit as T;

  const base = model as AnyRecord;
  const doGenerate = base['doGenerate'] as ((params: AnyRecord) => Promise<AnyRecord>) | undefined;
  const doStream = base['doStream'] as ((params: AnyRecord) => Promise<AnyRecord>) | undefined;

  if (!doGenerate || !doStream) return model;

  const wrapped = {
    ...base,
    async doGenerate(params: AnyRecord) {
      const result = await doGenerate.call(model, params);
      const reasoningText = getGenerateReasoning(result);
      const content = Array.isArray((result as AnyRecord)?.['content'])
        ? (result as AnyRecord)['content'] as Array<AnyRecord>
        : [];
      const hasReasoning = content.some((part) => part['type'] === 'reasoning');

      if (!reasoningText || hasReasoning) return result;

      return {
        ...result,
        content: [{ type: 'reasoning', text: reasoningText }, ...content],
      };
    },
    async doStream(params: AnyRecord) {
      const result = await doStream.call(model, {
        ...params,
        includeRawChunks: true,
      });
      const forwardRaw = (params as AnyRecord)['includeRawChunks'] === true;
      const reasoningId = crypto.randomUUID();
      let reasoningOpen = false;
      const stream = (result as AnyRecord)['stream'] as ReadableStream<unknown>;

      return {
        ...result,
        stream: stream.pipeThrough(new TransformStream({
          transform(part: unknown, controller) {
            const rawPart = part as AnyRecord;
            if (rawPart['type'] === 'raw') {
              const delta = getChunkReasoning(rawPart['rawValue']);
              if (delta) {
                if (!reasoningOpen) {
                  reasoningOpen = true;
                  controller.enqueue({ type: 'reasoning-start', id: reasoningId });
                }
                controller.enqueue({ type: 'reasoning-delta', id: reasoningId, delta });
              }
              if (forwardRaw) controller.enqueue(part);
              return;
            }

            if (reasoningOpen && closesReasoning(rawPart['type'])) {
              reasoningOpen = false;
              controller.enqueue({ type: 'reasoning-end', id: reasoningId });
            }

            controller.enqueue(part);
          },
          flush(controller) {
            if (!reasoningOpen) return;
            controller.enqueue({ type: 'reasoning-end', id: reasoningId });
          },
        })),
      };
    },
  };

  WRAPPED_MODELS.set(model, wrapped);
  return wrapped as T;
}
