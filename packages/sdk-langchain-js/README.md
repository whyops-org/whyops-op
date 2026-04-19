# `@whyops/langchain-js`

WhyOps observability for LangChain.js.

Drop a single tracer into any LangChain call and WhyOps automatically captures:

- `user_message` — initial human input
- `llm_response` — model output, token usage, tool call declarations, finish reason, latency
- `tool_call_request` + `tool_call_response` — every tool execution, paired by span, with latency
- `error` — LLM errors, tool errors, chain errors

Supports `@langchain/core >= 0.3.0`. Works with any model provider available through LangChain (OpenAI, Anthropic, Azure, Google, Mistral, Ollama, Bedrock, etc.).

## Install

```bash
npm install @whyops/sdk @whyops/langchain-js @langchain/core
```

Install the provider package you use as well, for example:

```bash
npm install @langchain/openai
# or
npm install @langchain/anthropic
```

## Quick Start

```ts
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { WhyOps } from '@whyops/sdk';
import { WhyOpsLangChainTracer } from '@whyops/langchain-js';

const whyops = new WhyOps({
  apiKey: process.env.WHYOPS_API_KEY!,
  agentName: 'support-agent',
  agentMetadata: {
    systemPrompt: 'You are a helpful support agent.',
    tools: [],
  },
});

await whyops.initAgent();

const tracer = new WhyOpsLangChainTracer({ whyops });

const llm = new ChatOpenAI({ model: 'gpt-4o' });

const response = await llm.invoke(
  [new HumanMessage('What is the capital of France?')],
  { callbacks: [tracer] },
);

console.log(response.content);
```

## Options

```ts
const tracer = new WhyOpsLangChainTracer({
  whyops,                        // required — WhyOps client from @whyops/sdk
  traceId: 'session-abc-123',    // optional — stable ID for the conversation
  externalUserId: 'user_456',    // optional — your application's user ID
});
```

`traceId` is optional. If omitted, WhyOps uses the root LangChain run ID for the trace.
Pass an explicit value when you want to link this trace to other events emitted manually via `whyops.trace()`.

`externalUserId` is attached to every event so you can filter traces by user in the WhyOps dashboard.

## Agents and Tool Calls

Pass the tracer in `callbacks` on any LangChain invocation — chains, agents, individual LLMs, tools:

```ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const getWeather = tool(
  async ({ city }) => `${city}: 22°C, sunny`,
  {
    name: 'get_weather',
    description: 'Get current weather for a city.',
    schema: z.object({ city: z.string() }),
  },
);

const llmWithTools = llm.bindTools([getWeather]);

// Agent loop
const messages = [new HumanMessage('What is the weather in London?')];

while (true) {
  const response = await llmWithTools.invoke(messages, { callbacks: [tracer] });
  messages.push(response);

  const toolCalls = response.tool_calls ?? [];
  if (toolCalls.length === 0) break;

  for (const tc of toolCalls) {
    const result = await getWeather.invoke(tc.args, { callbacks: [tracer] });
    messages.push(new ToolMessage({ content: result, tool_call_id: tc.id ?? '' }));
  }
}
```

WhyOps captures `tool_call_request` when the tool starts and `tool_call_response` when it completes.
The two events are paired by a shared `spanId` so they appear as a single tool span in the UI.

## Multi-Turn Conversations

Reuse the same tracer with a stable `traceId` across turns:

```ts
const tracer = new WhyOpsLangChainTracer({
  whyops,
  traceId: `session-${userId}`,
  externalUserId: userId,
});

// Turn 1
await llm.invoke([new HumanMessage('Hello')], { callbacks: [tracer] });

// Turn 2 — same tracer, same traceId, events grouped together
await llm.invoke([new HumanMessage('Follow-up question')], { callbacks: [tracer] });
```

## Provider Notes

- Provider and model name are extracted automatically from LangChain's `Serialized` metadata.
- Supported provider detection: OpenAI, Azure OpenAI, Anthropic, Google, Mistral, Ollama, Bedrock, Cohere, Groq, Fireworks, Together. Unknown providers fall back to `"unknown"`.
- Token usage is read from `llmOutput.tokenUsage` (OpenAI style) first, then from `usage_metadata` on the response message (standardized LangChain format, includes prompt cache fields).
- Events are sent in the background and never block your application. All failures are logged and swallowed.

## API

```ts
new WhyOpsLangChainTracer(options: WhyOpsLangChainTracerOptions)
```

```ts
interface WhyOpsLangChainTracerOptions {
  whyops: WhyOps;          // WhyOps client instance
  traceId?: string;        // Optional stable session ID
  externalUserId?: string; // Optional application user ID
}
```

Pass the tracer instance in `{ callbacks: [tracer] }` on any LangChain call.
