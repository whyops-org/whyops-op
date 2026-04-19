import assert from 'node:assert/strict';
import { registerWhyOps, withWhyOps, embed } from './index.js';

function createTraceRecorder() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  return {
    calls,
    trace: {
      userMessage: async (...args: unknown[]) => { calls.push({ method: 'userMessage', args }); },
      llmThinking: async (...args: unknown[]) => { calls.push({ method: 'llmThinking', args }); },
      llmResponse: async (...args: unknown[]) => { calls.push({ method: 'llmResponse', args }); },
      toolCallRequest: async (...args: unknown[]) => {
        calls.push({ method: 'toolCallRequest', args });
        return 'span-test';
      },
      toolCallResponse: async (...args: unknown[]) => { calls.push({ method: 'toolCallResponse', args }); },
      embeddingRequest: async (...args: unknown[]) => { calls.push({ method: 'embeddingRequest', args }); },
      embeddingResponse: async (...args: unknown[]) => { calls.push({ method: 'embeddingResponse', args }); },
      error: async (...args: unknown[]) => { calls.push({ method: 'error', args }); },
    },
  };
}

async function testWithWhyOpsExternalUserId() {
  const recorder = createTraceRecorder();
  registerWhyOps({ trace: () => recorder.trace } as never);

  const wrapped = withWhyOps({
    model: { provider: 'openai', modelId: 'gpt-test' },
    prompt: 'hello',
  }, {
    traceId: 'trace-123',
    externalUserId: 'user_123',
  });

  await (wrapped as Record<string, (...args: unknown[]) => Promise<void>>)['onStepFinish']?.({
    text: 'world',
    finishReason: 'stop',
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    toolCalls: [],
    toolResults: [],
  });

  const userMessageOptions = recorder.calls.find((call) => call.method === 'userMessage')?.args[1] as Record<string, unknown>;
  const llmResponseOptions = recorder.calls.find((call) => call.method === 'llmResponse')?.args[3] as Record<string, unknown>;

  assert.equal(userMessageOptions['externalUserId'], 'user_123');
  assert.equal(llmResponseOptions['externalUserId'], 'user_123');
}

async function testWithWhyOpsOmitsExternalUserId() {
  const recorder = createTraceRecorder();
  registerWhyOps({ trace: () => recorder.trace } as never);

  const wrapped = withWhyOps({
    model: { provider: 'openai', modelId: 'gpt-test' },
    prompt: 'hello',
  });

  await (wrapped as Record<string, (...args: unknown[]) => Promise<void>>)['onStepFinish']?.({
    text: 'world',
    finishReason: 'stop',
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    toolCalls: [],
    toolResults: [],
  });

  const userMessageOptions = recorder.calls.find((call) => call.method === 'userMessage')?.args[1] as Record<string, unknown>;
  assert.ok(!('externalUserId' in userMessageOptions));
}

async function testEmbedExternalUserId() {
  const recorder = createTraceRecorder();
  registerWhyOps({ trace: () => recorder.trace } as never);

  const model = {
    specificationVersion: 'v3' as const,
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    maxEmbeddingsPerCall: 10,
    supportsParallelCalls: true,
    async doEmbed() {
      return {
        embeddings: [[0.1, 0.2]],
        usage: { tokens: 7 },
        warnings: [],
      };
    },
  };

  await embed({
    model,
    value: 'hello',
  }, {
    externalUserId: 'user_456',
  });

  const requestOptions = recorder.calls.find((call) => call.method === 'embeddingRequest')?.args[1] as Record<string, unknown>;
  const responseOptions = recorder.calls.find((call) => call.method === 'embeddingResponse')?.args[4] as Record<string, unknown>;
  assert.equal(requestOptions['externalUserId'], 'user_456');
  assert.equal(responseOptions['externalUserId'], 'user_456');
}

await testWithWhyOpsExternalUserId();
await testWithWhyOpsOmitsExternalUserId();
await testEmbedExternalUserId();
console.log('context.test.ts passed');
