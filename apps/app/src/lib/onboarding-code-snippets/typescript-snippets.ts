import { fillTemplate, getProviderDefaults, getSnippetValues } from "./shared";
import type { CodeSnippet, CodeSnippetConfig, CodeSnippetData } from "./types";

const TYPESCRIPT_EVENTS_TEMPLATE = `
import { WhyOps } from "@whyops/sdk";

const whyops = new WhyOps({
  apiKey: "{{apiKey}}",
  agentName: "{{agentName}}",
  proxyBaseUrl: "{{proxyBaseUrl}}",
  analyseBaseUrl: "{{analyseBaseUrl}}",
  agentMetadata: {
    systemPrompt: "You are a precise customer support assistant.",
    tools: [],
  },
});

await whyops.initAgent();

const trace = whyops.trace("{{traceId}}");

await trace.userMessage(
  [{ role: "user", content: "{{prompt}}" }],
  { externalUserId: "{{externalUserId}}" }
);

const spanId = await trace.toolCallRequest(
  "{{tool}}",
  [{ name: "{{tool}}", arguments: { id: "123" } }],
  { latencyMs: 12 }
);

await trace.toolCallResponse(
  "{{tool}}",
  spanId,
  [{ name: "{{tool}}", arguments: { id: "123" } }],
  { status: "resolved" },
  { latencyMs: 91 }
);

await trace.llmResponse("{{runtimeModel}}", "{{provider}}", "{{reply}}", {
  finishReason: "stop",
  latencyMs: 420,
  usage: { promptTokens: 42, completionTokens: 16, totalTokens: 58 },
});
`;

function getOpenAIProxyTemplate() {
  return `
import OpenAI from "openai";
import { WhyOps } from "@whyops/sdk";

const whyops = new WhyOps({
  apiKey: "{{apiKey}}",
  agentName: "{{agentName}}",
  proxyBaseUrl: "{{proxyBaseUrl}}",
  analyseBaseUrl: "{{analyseBaseUrl}}",
  agentMetadata: {
    systemPrompt: "You are a precise customer support assistant.",
    tools: [],
  },
});

await whyops.initAgent();

const traceId = "{{traceId}}";
const openai = whyops.openai(new OpenAI({ apiKey: "{{apiKey}}" }));

openai.defaultHeaders = {
  ...(openai as any).defaultHeaders,
  "X-Trace-ID": traceId,
  "X-Thread-ID": traceId,
  "X-External-User-Id": "{{externalUserId}}",
};

const response = await openai.chat.completions.create({
  model: "{{directModel}}",
  messages: [{ role: "user", content: "{{prompt}}" }],
});

console.log(response.choices[0]?.message?.content);
`;
}

function getAnthropicProxyTemplate() {
  return `
import Anthropic from "@anthropic-ai/sdk";
import { WhyOps } from "@whyops/sdk";

const whyops = new WhyOps({
  apiKey: "{{apiKey}}",
  agentName: "{{agentName}}",
  proxyBaseUrl: "{{proxyBaseUrl}}",
  analyseBaseUrl: "{{analyseBaseUrl}}",
  agentMetadata: {
    systemPrompt: "You are a precise customer support assistant.",
    tools: [],
  },
});

await whyops.initAgent();

const traceId = "{{traceId}}";
const anthropic = whyops.anthropic(new Anthropic({ apiKey: "{{apiKey}}" }));

anthropic.defaultHeaders = {
  ...(anthropic as any).defaultHeaders,
  "X-Trace-ID": traceId,
  "X-Thread-ID": traceId,
  "X-External-User-Id": "{{externalUserId}}",
};

const message = await anthropic.messages.create({
  model: "{{directModel}}",
  max_tokens: 800,
  messages: [{ role: "user", content: "{{prompt}}" }],
});

console.log(message.content);
`;
}

export function getTypeScriptProxySnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  const provider = getProviderDefaults(data.providerSlug);
  const template = provider.provider === "anthropic" ? getAnthropicProxyTemplate() : getOpenAIProxyTemplate();
  return {
    filename: "whyops.ts",
    code: fillTemplate(template, getSnippetValues(data, config)),
  };
}

export function getTypeScriptEventsSnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "trace.ts",
    code: fillTemplate(TYPESCRIPT_EVENTS_TEMPLATE, getSnippetValues(data, config)),
  };
}
