import { fillTemplate, getProviderDefaults, getSnippetValues } from "./shared";
import type { CodeSnippet, CodeSnippetConfig, CodeSnippetData } from "./types";

const GO_EVENTS_TEMPLATE = `
package main

import (
  "context"

  whyops "github.com/whyops-org/whyops-op/packages/sdk-go"
)

func main() {
  ctx := context.Background()

  sdk := whyops.New(whyops.Config{
    APIKey: "{{apiKey}}",
    AgentName: "{{agentName}}",
    ProxyBaseURL: "{{proxyBaseUrl}}",
    AnalyseBaseURL: "{{analyseBaseUrl}}",
    AgentMetadata: whyops.AgentMetadata{SystemPrompt: "You are a precise customer support assistant.", Tools: []whyops.AgentTool{}},
  })

  trace := sdk.Trace("{{traceId}}")
  _ = trace.UserMessage(ctx, []whyops.MessageItem{{Role: "user", Content: "{{prompt}}"}}, whyops.UserMessageOptions{
    EventOptions: whyops.EventOptions{ExternalUserID: "{{externalUserId}}"},
  })

  spanID, _ := trace.ToolCallRequest(ctx, "{{tool}}",
    []whyops.ToolCallPair{{Name: "{{tool}}", Arguments: map[string]any{"id": "123"}}},
    whyops.ToolCallRequestOptions{LatencyMs: 12},
  )

  _ = trace.ToolCallResponse(ctx, "{{tool}}", spanID,
    []whyops.ToolCallPair{{Name: "{{tool}}", Arguments: map[string]any{"id": "123"}}},
    map[string]any{"status": "resolved"},
    whyops.ToolCallResponseOptions{LatencyMs: 91},
  )

  _ = trace.LLMResponse(ctx, "{{runtimeModel}}", "{{provider}}", "{{reply}}", whyops.LLMResponseOptions{
    FinishReason: "stop",
    LatencyMs: 420,
    Usage: &whyops.TokenUsage{PromptTokens: 42, CompletionTokens: 16, TotalTokens: 58},
  })
}
`;

function getOpenAIProxyTemplate() {
  return `
package main

import (
  "bytes"
  "context"
  "encoding/json"
  "fmt"
  "io"
  "net/http"

  whyops "github.com/whyops-org/whyops-op/packages/sdk-go"
)

func main() {
  ctx := context.Background()

  sdk := whyops.New(whyops.Config{
    APIKey: "{{apiKey}}",
    AgentName: "{{agentName}}",
    ProxyBaseURL: "{{proxyBaseUrl}}",
    AnalyseBaseURL: "{{analyseBaseUrl}}",
    AgentMetadata: whyops.AgentMetadata{SystemPrompt: "You are a precise customer support assistant.", Tools: []whyops.AgentTool{}},
  })

  _ = sdk.InitAgent(ctx)
  client := sdk.ProxyHTTPClient()

  body, _ := json.Marshal(map[string]any{
    "model": "{{directModel}}",
    "messages": []map[string]string{{"role": "user", "content": "{{prompt}}"}},
  })

  req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "{{proxyBaseUrl}}/v1/chat/completions", bytes.NewReader(body))
  req.Header.Set("Content-Type", "application/json")
  req.Header.Set("X-Trace-ID", "{{traceId}}")
  req.Header.Set("X-Thread-ID", "{{traceId}}")

  resp, err := client.Do(req)
  if err != nil {
    panic(err)
  }
  defer resp.Body.Close()

  payload, _ := io.ReadAll(resp.Body)
  fmt.Println(resp.Status)
  fmt.Println(string(payload))
}
`;
}

function getAnthropicProxyTemplate() {
  return `
package main

import (
  "bytes"
  "context"
  "encoding/json"
  "fmt"
  "io"
  "net/http"

  whyops "github.com/whyops-org/whyops-op/packages/sdk-go"
)

func main() {
  ctx := context.Background()

  sdk := whyops.New(whyops.Config{
    APIKey: "{{apiKey}}",
    AgentName: "{{agentName}}",
    ProxyBaseURL: "{{proxyBaseUrl}}",
    AnalyseBaseURL: "{{analyseBaseUrl}}",
    AgentMetadata: whyops.AgentMetadata{SystemPrompt: "You are a precise customer support assistant.", Tools: []whyops.AgentTool{}},
  })

  _ = sdk.InitAgent(ctx)
  client := sdk.ProxyHTTPClient()

  body, _ := json.Marshal(map[string]any{
    "model": "{{directModel}}",
    "max_tokens": 800,
    "messages": []map[string]string{{"role": "user", "content": "{{prompt}}"}},
  })

  req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "{{proxyBaseUrl}}/v1/messages", bytes.NewReader(body))
  req.Header.Set("Content-Type", "application/json")
  req.Header.Set("anthropic-version", "2023-06-01")
  req.Header.Set("X-Trace-ID", "{{traceId}}")
  req.Header.Set("X-Thread-ID", "{{traceId}}")

  resp, err := client.Do(req)
  if err != nil {
    panic(err)
  }
  defer resp.Body.Close()

  payload, _ := io.ReadAll(resp.Body)
  fmt.Println(resp.Status)
  fmt.Println(string(payload))
}
`;
}

export function getGoProxySnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  const provider = getProviderDefaults(data.providerSlug);
  const template = provider.provider === "anthropic" ? getAnthropicProxyTemplate() : getOpenAIProxyTemplate();
  return {
    filename: "main.go",
    code: fillTemplate(template, getSnippetValues(data, config)),
  };
}

export function getGoEventsSnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "main.go",
    code: fillTemplate(GO_EVENTS_TEMPLATE, getSnippetValues(data, config)),
  };
}
