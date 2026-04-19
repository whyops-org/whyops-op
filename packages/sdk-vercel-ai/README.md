# `@whyops/vercel-ai-sdk`

WhyOps observability for the Vercel AI SDK.

This package wraps `generateText`, `streamText`, `embed`, and `embedMany` flows so WhyOps captures:

- `user_message`
- `llm_response`
- `llm_thinking` when readable reasoning text is available
- `tool_call_request`
- `tool_call_response`
- `error`
- `embedding_request`
- `embedding_response`

Supports `ai >= 5.0.0`.

## Install

```bash
npm install @whyops/sdk @whyops/vercel-ai-sdk ai
```

Install the provider package you use as well, for example:

```bash
npm install @ai-sdk/openai
```

## Quick Start

```ts
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { WhyOps } from '@whyops/sdk';
import { registerWhyOps, withWhyOps } from '@whyops/vercel-ai-sdk';

const whyops = new WhyOps({
  apiKey: process.env.WHYOPS_API_KEY!,
  agentName: 'support-agent',
  agentMetadata: {
    systemPrompt: 'You are a helpful support agent.',
    tools: [],
  },
});

registerWhyOps(whyops);

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const result = await generateText(withWhyOps({
  model: openai.chat('gpt-4.1'),
  system: 'Reply briefly.',
  prompt: 'What is the capital of France?',
}));

console.log(result.text);
```

## Optional `whyopsCtx`

Pass `whyopsCtx` as the second argument only when you want to attach request-scoped metadata such as your application's user ID or a caller-supplied trace ID:

```ts
const whyopsCtx = {
  externalUserId: session.user.id,
};

const result = await generateText(withWhyOps({
  model: openai.chat('gpt-4.1'),
  prompt: 'Summarize this ticket.',
}, whyopsCtx));
```

`whyopsCtx` is optional. If you do not pass it, the wrapper behaves exactly as before.

## Tool Calls

`withWhyOps()` captures multi-step tool use automatically. On `ai@5`, it also normalizes `maxSteps` into `stopWhen` so tool loops complete correctly.

```ts
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText(withWhyOps({
  model: openai.chat('gpt-4.1'),
  system: 'Use tools when needed.',
  prompt: 'What is the weather in Madrid and what is 11 * 11?',
  maxSteps: 5,
  tools: {
    get_weather: tool({
      description: 'Get weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, temp: 22, condition: 'clear' }),
    }),
    calculate: tool({
      description: 'Calculate an expression',
      inputSchema: z.object({ expression: z.string() }),
      execute: async ({ expression }) => ({ result: eval(expression) }),
    }),
  },
}));
```

## Streaming

```ts
import { streamText } from 'ai';

const result = streamText(withWhyOps({
  model: openai.chat('gpt-4.1'),
  prompt: 'Name three oceans.',
}, whyopsCtx));

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Embeddings

Use the re-exported helpers instead of importing from `ai` directly if you want embedding traces:

```ts
import { embed, embedMany } from '@whyops/vercel-ai-sdk';

const one = await embed({
  model: embeddingModel,
  value: 'hello world',
}, whyopsCtx);

const many = await embedMany({
  model: embeddingModel,
  values: ['alpha', 'beta'],
}, whyopsCtx);
```

## Provider Notes

- OpenAI-compatible providers that return nonstandard reasoning fields such as `reasoning_content` are normalized into standard reasoning parts before WhyOps captures the step.
- If a provider reports reasoning token usage but does not expose readable reasoning text, WhyOps will not emit a fake `llm_thinking` event.
- Verified against OpenAI-compatible, Azure, and Anthropic-compatible provider paths.

## API

- `registerWhyOps(whyops: WhyOps): void`
- `withWhyOps<T extends object>(options: T, whyopsCtx?: WhyOpsContext): T`
- `embed(options, whyopsCtx?: WhyOpsContext)`
- `embedMany(options, whyopsCtx?: WhyOpsContext)`

`WhyOpsContext` currently supports:

- `externalUserId?: string`
- `traceId?: string`

Call `registerWhyOps()` once at startup, then wrap each `generateText()` or `streamText()` call with `withWhyOps()`.

## Publish

```bash
npm publish --access public
```
