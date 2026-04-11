import { fillTemplate, getProviderDefaults, getSnippetValues } from "./shared";
import type { CodeSnippet, CodeSnippetConfig, CodeSnippetData } from "./types";

const HTTP_EVENTS_TEMPLATE = `
curl -X POST {{analyseBaseUrl}}/events/ingest \\
  -H "Authorization: Bearer {{apiKey}}" \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "traceId": "{{traceId}}",
      "agentName": "{{agentName}}",
      "eventType": "user_message",
      "externalUserId": "{{externalUserId}}",
      "content": {
        "messages": [{ "role": "user", "content": "{{prompt}}" }]
      }
    },
    {
      "traceId": "{{traceId}}",
      "agentName": "{{agentName}}",
      "spanId": "tool-span-1",
      "eventType": "tool_call_request",
      "content": {
        "toolCalls": [{ "name": "{{tool}}", "arguments": { "id": "123" } }]
      },
      "metadata": { "tool": "{{tool}}", "latencyMs": 12 }
    },
    {
      "traceId": "{{traceId}}",
      "agentName": "{{agentName}}",
      "spanId": "tool-span-1",
      "eventType": "tool_call_response",
      "content": {
        "toolCalls": [{ "name": "{{tool}}", "arguments": { "id": "123" } }],
        "toolResults": { "status": "resolved" }
      },
      "metadata": { "tool": "{{tool}}", "latencyMs": 91 }
    }
  ]'
`;

function getOpenAIProxyTemplate() {
  return `
curl -X POST {{proxyBaseUrl}}/v1/chat/completions \\
  -H "Authorization: Bearer {{apiKey}}" \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Name: {{agentName}}" \\
  -H "X-Trace-ID: {{traceId}}" \\
  -H "X-Thread-ID: {{traceId}}" \\
  -H "X-External-User-Id: {{externalUserId}}" \\
  -d '{
    "model": "{{directModel}}",
    "messages": [{ "role": "user", "content": "{{prompt}}" }]
  }'
`;
}

function getAnthropicProxyTemplate() {
  return `
curl -X POST {{proxyBaseUrl}}/v1/messages \\
  -H "x-api-key: {{apiKey}}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Name: {{agentName}}" \\
  -H "X-Trace-ID: {{traceId}}" \\
  -H "X-Thread-ID: {{traceId}}" \\
  -H "X-External-User-Id: {{externalUserId}}" \\
  -d '{
    "model": "{{directModel}}",
    "max_tokens": 800,
    "messages": [{ "role": "user", "content": "{{prompt}}" }]
  }'
`;
}

export function getHttpProxySnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  const provider = getProviderDefaults(data.providerSlug);
  const template = provider.provider === "anthropic" ? getAnthropicProxyTemplate() : getOpenAIProxyTemplate();
  return {
    filename: "proxy-request.sh",
    code: fillTemplate(template, getSnippetValues(data, config)),
  };
}

export function getHttpEventsSnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "events-ingest.sh",
    code: fillTemplate(HTTP_EVENTS_TEMPLATE, getSnippetValues(data, config)),
  };
}
