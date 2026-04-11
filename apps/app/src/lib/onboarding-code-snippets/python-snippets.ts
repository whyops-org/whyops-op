import { fillTemplate, getProviderDefaults, getSnippetValues } from "./shared";
import type { CodeSnippet, CodeSnippetConfig, CodeSnippetData } from "./types";

const PYTHON_EVENTS_TEMPLATE = `
from whyops import WhyOps

sdk = WhyOps(
    api_key="{{apiKey}}",
    agent_name="{{agentName}}",
    proxy_base_url="{{proxyBaseUrl}}",
    analyse_base_url="{{analyseBaseUrl}}",
    agent_metadata={
        "systemPrompt": "You are a precise customer support assistant.",
        "tools": [],
    },
)

sdk.init_agent_sync()

trace = sdk.trace("{{traceId}}")
trace.user_message_sync(
    [{"role": "user", "content": "{{prompt}}"}],
    external_user_id="{{externalUserId}}",
)

span_id = trace.tool_call_request_sync(
    "{{tool}}",
    [{"name": "{{tool}}", "arguments": {"id": "123"}}],
    latency_ms=11,
)

trace.tool_call_response_sync(
    "{{tool}}",
    span_id,
    [{"name": "{{tool}}", "arguments": {"id": "123"}}],
    {"status": "resolved"},
    latency_ms=88,
)

trace.llm_response_sync(
    "{{runtimeModel}}",
    "{{provider}}",
    "{{reply}}",
    finish_reason="stop",
    latency_ms=390,
    usage={"promptTokens": 42, "completionTokens": 16, "totalTokens": 58},
)
`;

function getOpenAIProxyTemplate() {
  return `
from openai import OpenAI
from whyops import WhyOps

sdk = WhyOps(
    api_key="{{apiKey}}",
    agent_name="{{agentName}}",
    proxy_base_url="{{proxyBaseUrl}}",
    analyse_base_url="{{analyseBaseUrl}}",
    agent_metadata={"systemPrompt": "You are a precise customer support assistant.", "tools": []},
)

sdk.init_agent_sync()

trace_id = "{{traceId}}"
client = sdk.openai(OpenAI(api_key="{{apiKey}}"))
client.default_headers = {
    **(client.default_headers or {}),
    "X-Trace-ID": trace_id,
    "X-Thread-ID": trace_id,
    "X-External-User-Id": "{{externalUserId}}",
}

completion = client.chat.completions.create(
    model="{{directModel}}",
    messages=[{"role": "user", "content": "{{prompt}}"}],
)

print(completion.choices[0].message.content)
`;
}

function getAnthropicProxyTemplate() {
  return `
from anthropic import Anthropic
from whyops import WhyOps

sdk = WhyOps(
    api_key="{{apiKey}}",
    agent_name="{{agentName}}",
    proxy_base_url="{{proxyBaseUrl}}",
    analyse_base_url="{{analyseBaseUrl}}",
    agent_metadata={"systemPrompt": "You are a precise customer support assistant.", "tools": []},
)

sdk.init_agent_sync()

trace_id = "{{traceId}}"
client = sdk.anthropic(Anthropic(api_key="{{apiKey}}"))
client.default_headers = {
    **(client.default_headers or {}),
    "X-Trace-ID": trace_id,
    "X-Thread-ID": trace_id,
    "X-External-User-Id": "{{externalUserId}}",
}

message = client.messages.create(
    model="{{directModel}}",
    max_tokens=800,
    messages=[{"role": "user", "content": "{{prompt}}"}],
)

print(message.content)
`;
}

export function getPythonProxySnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  const provider = getProviderDefaults(data.providerSlug);
  const template = provider.provider === "anthropic" ? getAnthropicProxyTemplate() : getOpenAIProxyTemplate();
  return {
    filename: "main.py",
    code: fillTemplate(template, getSnippetValues(data, config)),
  };
}

export function getPythonEventsSnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "main.py",
    code: fillTemplate(PYTHON_EVENTS_TEMPLATE, getSnippetValues(data, config)),
  };
}
