# `@whyops/sdk`

Type-safe TypeScript SDK for WhyOps AI agent observability.

## Install

```bash
npm install @whyops/sdk
```

## Quick start

```ts
import { WhyOps } from '@whyops/sdk';

const whyops = new WhyOps({
  apiKey: process.env.WHYOPS_API_KEY!,
  agentName: 'support-agent',
  agentMetadata: {
    systemPrompt: 'You are a helpful support agent.',
    tools: [],
  },
});

const trace = whyops.trace('session-123');

await trace.userMessage([
  { role: 'user', content: 'Reset my password.' },
]);

await trace.llmResponse(
  'openai/gpt-4o-mini',
  'openai',
  'I can help with that.',
  {
    latencyMs: 420,
    usage: { promptTokens: 42, completionTokens: 16, totalTokens: 58 },
    finishReason: 'stop',
  },
);
```

## Proxy mode

```ts
import OpenAI from 'openai';
import { WhyOps } from '@whyops/sdk';

const whyops = new WhyOps({
  apiKey: process.env.WHYOPS_API_KEY!,
  agentName: 'support-agent',
  agentMetadata: {
    systemPrompt: 'You are a helpful support agent.',
    tools: [],
  },
});

const openai = whyops.openai(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
);
```

If `proxyBaseUrl` or `analyseBaseUrl` are omitted, the SDK uses WhyOps hosted defaults.

## Publish

```bash
npm publish --access public
```
