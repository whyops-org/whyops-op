/**
 * WhyOps TypeScript SDK — integration test
 * Run: node --import tsx test.ts
 */
import { WhyOps } from './src/client.js';

const API_KEY = process.env.WHYOPS_SDK_TEST_API_KEY;
const PROXY_URL = process.env.WHYOPS_SDK_TEST_PROXY_URL;
const ANALYSE_URL = process.env.WHYOPS_SDK_TEST_ANALYSE_URL;

const AGENT_NAME = process.env.WHYOPS_SDK_TEST_AGENT_NAME ?? 'sdk-ts-test-agent';

if (!API_KEY) {
  throw new Error('Set WHYOPS_SDK_TEST_API_KEY to run the integration test.');
}

const sdk = new WhyOps({
  apiKey: API_KEY,
  agentName: AGENT_NAME,
  agentMetadata: {
    systemPrompt: 'You are a test agent for the WhyOps TypeScript SDK.',
    description: 'SDK integration test',
    tools: [
      {
        name: 'search',
        description: 'Search the web',
        inputSchema: JSON.stringify({ type: 'object', properties: { query: { type: 'string' } } }),
        outputSchema: JSON.stringify({ type: 'array', items: { type: 'string' } }),
      },
    ],
  },
  ...(PROXY_URL ? { proxyBaseUrl: PROXY_URL } : {}),
  ...(ANALYSE_URL ? { analyseBaseUrl: ANALYSE_URL } : {}),
});

function pass(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string, err?: unknown) { console.error(`  ✗ ${msg}`, err ?? ''); }

async function run() {
  console.log('\n── TypeScript SDK integration test ──────────────────────');

  // 1. Agent init
  console.log('\n[1] Agent init');
  try {
    const info = await sdk.initAgent();
    if (info?.agentId) {
      pass(`init ok — status=${info.status} agentId=${info.agentId.slice(0, 8)}…`);
    } else {
      fail('no agentId returned');
    }
  } catch (e) {
    fail('threw', e);
  }

  // 2. Manual events — full trace
  const traceId = `ts-sdk-test-${Date.now()}`;
  console.log(`\n[2] Manual events (traceId=${traceId})`);
  const trace = sdk.trace(traceId);

  try {
    await trace.userMessage([{ role: 'user', content: 'What is the weather in Paris?' }], {
      metadata: { systemPrompt: 'You are a weather assistant.' },
    });
    pass('userMessage');
  } catch (e) { fail('userMessage', e); }

  try {
    const spanId = await trace.toolCallRequest('search', [{ name: 'search', arguments: { query: 'Paris weather' } }], { latencyMs: 45 });
    pass(`toolCallRequest spanId=${spanId.slice(0, 8)}…`);

    await trace.toolCallResponse('search', spanId, [{ name: 'search', arguments: { query: 'Paris weather' } }], { results: ['Sunny, 22°C'] }, { latencyMs: 210 });
    pass('toolCallResponse');
  } catch (e) { fail('tool call pair', e); }

  try {
    await trace.llmResponse('openai/gpt-4o', 'openai', 'It is sunny and 22°C in Paris today.', {
      usage: { promptTokens: 42, completionTokens: 15, totalTokens: 57 },
      latencyMs: 820,
      finishReason: 'stop',
    });
    pass('llmResponse');
  } catch (e) { fail('llmResponse', e); }

  try {
    await trace.llmThinking('Let me check the weather data…', { signature: 'sig_abc' });
    pass('llmThinking');
  } catch (e) { fail('llmThinking', e); }

  try {
    await trace.embeddingRequest(['Paris weather forecast', 'temperature in Paris']);
    pass('embeddingRequest');
  } catch (e) { fail('embeddingRequest', e); }

  try {
    await trace.embeddingResponse('openai/text-embedding-3-small', 'openai', 2, 1536, {
      totalTokens: 8,
      latencyMs: 120,
    });
    pass('embeddingResponse');
  } catch (e) { fail('embeddingResponse', e); }

  try {
    await trace.toolResult('search', { result: 'Sunny 22°C' });
    pass('toolResult');
  } catch (e) { fail('toolResult', e); }

  try {
    await trace.error('Simulated timeout for test', { status: 504, stack: 'Error: timeout\n  at test.ts:1' });
    pass('error event');
  } catch (e) { fail('error', e); }

  console.log('\n── Done ─────────────────────────────────────────────────\n');
}

run().catch((e) => { console.error('Unhandled:', e); process.exit(1); });
