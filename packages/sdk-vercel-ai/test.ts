/**
 * @whyops/vercel-ai-sdk — integration test
 *
 * Prerequisites:
 *   1. Run `npm run local:dev:all` from the monorepo root
 *   2. Get a WhyOps API key from http://localhost:3000
 *
 * Environment variables:
 *   WHYOPS_API_KEY          (required) — your WhyOps API key
 *   WHYOPS_ANALYSE_URL      (optional) — defaults to http://localhost:8081/api
 *   OPENAI_API_KEY          (optional) — real OpenAI key; falls back to JUDGE_LLM
 *   JUDGE_LLM_BASE_URL      (optional) — LiteLLM-compatible base URL
 *   JUDGE_LLM_API_KEY       (optional) — LiteLLM API key
 *   JUDGE_LLM_MODEL         (optional) — model name (default: gpt-4o-mini)
 *
 * Run:
 *   node --import tsx test.ts
 */

import { generateText, streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { WhyOps } from '@whyops/sdk';
import { registerWhyOps, withWhyOps } from './index.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const WHYOPS_API_KEY = process.env['WHYOPS_API_KEY'];
const ANALYSE_URL = process.env['WHYOPS_ANALYSE_URL'] ?? 'http://localhost:8081/api';

if (!WHYOPS_API_KEY) {
  console.error('\n  ERROR: Set WHYOPS_API_KEY to run this test.');
  console.error('  Get one from http://localhost:3000 after starting local:dev:all\n');
  process.exit(1);
}

// LLM config — prefer real OpenAI, fall back to JUDGE_LLM (LiteLLM)
const llmBaseUrl = process.env['JUDGE_LLM_BASE_URL'];
const llmApiKey = process.env['OPENAI_API_KEY'] ?? process.env['JUDGE_LLM_API_KEY'] ?? 'sk-test';
const llmModel = process.env['JUDGE_LLM_MODEL'] ?? 'gpt-4o-mini';

const openai = createOpenAI({
  apiKey: llmApiKey,
  ...(llmBaseUrl ? { baseURL: llmBaseUrl } : {}),
  compatibility: 'compatible',
});

// .chat() forces /v1/chat/completions — avoids Responses API which LiteLLM doesn't support
const model = openai.chat(llmModel);

// ─── WhyOps init ─────────────────────────────────────────────────────────────

const whyops = new WhyOps({
  apiKey: WHYOPS_API_KEY,
  agentName: 'vercel-ai-sdk-test-agent',
  agentMetadata: {
    systemPrompt: 'You are a helpful assistant that can look up weather and perform calculations.',
    description: 'Integration test agent for @whyops/vercel-ai-sdk',
    tools: [
      {
        name: 'get_weather',
        description: 'Get current weather for a city',
        inputSchema: JSON.stringify({ type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }),
        outputSchema: JSON.stringify({ type: 'object', properties: { temp: { type: 'number' }, condition: { type: 'string' } } }),
      },
      {
        name: 'calculate',
        description: 'Perform a math calculation',
        inputSchema: JSON.stringify({ type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] }),
        outputSchema: JSON.stringify({ type: 'string' }),
      },
    ],
  },
  analyseBaseUrl: ANALYSE_URL,
});

registerWhyOps(whyops);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pass(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string, err?: unknown) { console.error(`  ✗ ${msg}`, err ?? ''); }
function section(title: string) { console.log(`\n── ${title} ${'─'.repeat(Math.max(4, 50 - title.length))}`); }

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testAgentInit() {
  section('1. Agent init');
  try {
    const info = await whyops.initAgent();
    if (info?.agentId) {
      pass(`init ok — status=${info.status} agentId=${info.agentId.slice(0, 8)}…`);
    } else {
      fail('no agentId returned');
    }
  } catch (e) {
    fail('threw', e);
  }
}

async function testGenerateText() {
  section('2. generateText — simple prompt (userMessage + llmResponse)');
  try {
    const result = await generateText(withWhyOps({
      model,
      system: 'You are a concise assistant. Reply in one sentence.',
      prompt: 'What is the capital of France?',
    }));
    pass(`generateText ok — finishReason=${result.finishReason} tokens=${result.usage.totalTokens}`);
    pass(`response: "${result.text.slice(0, 80)}"`);
  } catch (e) {
    fail('generateText threw', e);
  }
}

async function testGenerateTextWithTools() {
  section('3. generateText — tool call (toolCallRequest + toolCallResponse)');
  try {
    const result = await generateText(withWhyOps({
      model,
      system: 'You are a weather assistant. Always use the get_weather tool when asked about weather.',
      prompt: 'What is the weather like in Tokyo right now?',
      maxSteps: 3,
      tools: {
        get_weather: tool({
          description: 'Get current weather for a city',
          inputSchema: z.object({ city: z.string() }),
          execute: async ({ city }) => {
            // Simulated response — no real API call
            await new Promise(r => setTimeout(r, 80)); // simulate latency
            return { temp: 24, condition: 'partly cloudy', city };
          },
        }),
      },
    }));

    const toolCalls = result.steps.flatMap(s => s.toolCalls);
    if (toolCalls.length > 0) {
      pass(`tool called: ${toolCalls.map(t => (t as { toolName: string }).toolName).join(', ')}`);
    } else {
      fail('no tool calls made — LLM may have answered directly');
    }
    pass(`final text: "${result.text.slice(0, 80)}"`);
    pass(`steps: ${result.steps.length}, totalTokens: ${result.usage.totalTokens}`);
  } catch (e) {
    fail('generateText+tools threw', e);
  }
}

async function testStreamText() {
  section('4. streamText — streaming response');
  try {
    const result = streamText(withWhyOps({
      model,
      system: 'You are a concise assistant. Reply in exactly one sentence.',
      prompt: 'Name three planets in the solar system.',
    }));

    let chunks = 0;
    for await (const chunk of result.textStream) {
      chunks++;
      process.stdout.write(chunk);
    }
    console.log(); // newline after stream

    const usage = await result.usage;
    pass(`streamed ${chunks} chunks, tokens=${usage.totalTokens}`);
  } catch (e) {
    fail('streamText threw', e);
  }
}

async function testMultiToolSteps() {
  section('5. generateText — multi-step with two tools');
  try {
    const result = await generateText(withWhyOps({
      model,
      system: 'You are a helpful assistant. Use tools when needed. After getting all info, summarize.',
      prompt: 'What is the weather in Paris and what is 42 * 7?',
      maxSteps: 5,
      tools: {
        get_weather: tool({
          description: 'Get current weather for a city',
          inputSchema: z.object({ city: z.string() }),
          execute: async ({ city }) => {
            await new Promise(r => setTimeout(r, 60));
            return { temp: 18, condition: 'cloudy', city };
          },
        }),
        calculate: tool({
          description: 'Perform arithmetic',
          inputSchema: z.object({ expression: z.string() }),
          execute: async ({ expression }) => {
            try {
              return { result: eval(expression) }; // safe: only our test
            } catch {
              return { result: null, error: 'invalid expression' };
            }
          },
        }),
      },
    }));

    const toolCalls = result.steps.flatMap(s => s.toolCalls);
    pass(`tool calls: ${toolCalls.map(t => (t as { toolName: string }).toolName).join(', ')}`);
    pass(`steps: ${result.steps.length}, totalTokens: ${result.usage.totalTokens}`);
    pass(`summary: "${result.text.slice(0, 100)}"`);
  } catch (e) {
    fail('multi-step threw', e);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══ @whyops/vercel-ai-sdk integration test ══════════════════════');
  console.log(`   Analyse URL : ${ANALYSE_URL}`);
  console.log(`   Model       : ${llmModel}`);
  console.log(`   LLM base    : ${llmBaseUrl ?? '(openai default)'}`);
  console.log('═'.repeat(60));

  await testAgentInit();
  await testGenerateText();
  await testGenerateTextWithTools();
  await testStreamText();
  await testMultiToolSteps();

  console.log('\n══ Done — check your WhyOps dashboard for captured traces ════\n');
}

main().catch(console.error);
