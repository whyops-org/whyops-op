// WhyOps Go SDK — integration test
// Run: cd test && go run main.go
package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"time"

	whyops "github.com/whyops-org/whyops-op/packages/sdk-go"
)

const (
	apiKey      = "YOPS-P7t8nP6yTZ-p0GQNkiEa4bDlBvD3fa5d"
	proxyURL    = "https://proxy.whyops.com"
	analyseURL  = "https://a.whyops.com/api"
	agentName   = "sdk-ts-test-agent"
)

func pass(msg string) { fmt.Printf("  ✓ %s\n", msg) }
func fail(msg string, err error) { fmt.Fprintf(os.Stderr, "  ✗ %s — %v\n", msg, err) }

func main() {
	// Skip TLS verification (same cert issue as other SDKs on this machine)
	http.DefaultTransport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
	}

	ctx := context.Background()

	sdk := whyops.New(whyops.Config{
		APIKey:    apiKey,
		AgentName: agentName,
		AgentMetadata: whyops.AgentMetadata{
			SystemPrompt: "You are a test agent for the WhyOps Go SDK.",
		},
		ProxyBaseURL:   proxyURL,
		AnalyseBaseURL: analyseURL,
	})

	fmt.Println("\n── Go SDK integration test ──────────────────────────────")

	// 1. Agent init
	fmt.Println("\n[1] Agent init")
	info := sdk.InitAgent(ctx)
	if info != nil && info.AgentID != "" {
		pass(fmt.Sprintf("init ok status=%s agentId=%s…", info.Status, info.AgentID[:8]))
	} else {
		fmt.Fprintln(os.Stderr, "  ✗ no agentId returned")
	}

	// 2. Manual events
	traceID := fmt.Sprintf("go-sdk-test-%d", time.Now().UnixMilli())
	fmt.Printf("\n[2] Manual events (traceId=%s)\n", traceID)
	trace := sdk.Trace(traceID)

	if err := trace.UserMessage(ctx, []whyops.MessageItem{{Role: "user", Content: "What is 2 + 2?"}}, whyops.UserMessageOptions{}); err != nil {
		fail("UserMessage", err)
	} else {
		pass("UserMessage")
	}

	spanID, err := trace.ToolCallRequest(ctx, "calculator",
		[]whyops.ToolCallPair{{Name: "calculator", Arguments: map[string]any{"expr": "2+2"}}},
		whyops.ToolCallRequestOptions{EventOptions: whyops.EventOptions{}, LatencyMs: 5},
	)
	if err != nil {
		fail("ToolCallRequest", err)
	} else {
		pass(fmt.Sprintf("ToolCallRequest spanId=%s…", spanID[:8]))
	}

	if err := trace.ToolCallResponse(ctx, "calculator", spanID,
		[]whyops.ToolCallPair{{Name: "calculator", Arguments: map[string]any{"expr": "2+2"}}},
		map[string]any{"result": 4},
		whyops.ToolCallResponseOptions{LatencyMs: 2},
	); err != nil {
		fail("ToolCallResponse", err)
	} else {
		pass("ToolCallResponse")
	}

	if err := trace.LLMResponse(ctx, "openai/gpt-4o", "openai", "2 + 2 = 4.",
		whyops.LLMResponseOptions{
			LatencyMs:    420,
			FinishReason: "stop",
			Usage:        &whyops.TokenUsage{PromptTokens: 18, CompletionTokens: 7, TotalTokens: 25},
		},
	); err != nil {
		fail("LLMResponse", err)
	} else {
		pass("LLMResponse")
	}

	if err := trace.LLMThinking(ctx, "Let me compute this…", whyops.LLMThinkingOptions{Signature: "sig_go_test"}); err != nil {
		fail("LLMThinking", err)
	} else {
		pass("LLMThinking")
	}

	if err := trace.EmbeddingRequest(ctx, []string{"2 + 2", "arithmetic"}, whyops.EventOptions{}); err != nil {
		fail("EmbeddingRequest", err)
	} else {
		pass("EmbeddingRequest")
	}

	if err := trace.EmbeddingResponse(ctx, "openai/text-embedding-3-small", "openai", 2, 1536,
		whyops.EmbeddingResponseOptions{TotalTokens: 5, LatencyMs: 67},
	); err != nil {
		fail("EmbeddingResponse", err)
	} else {
		pass("EmbeddingResponse")
	}

	if err := trace.ToolResult(ctx, "calculator", map[string]any{"result": 4}, whyops.EventOptions{}); err != nil {
		fail("ToolResult", err)
	} else {
		pass("ToolResult")
	}

	if err := trace.Error(ctx, "Simulated Go SDK test error", whyops.ErrorOptions{Status: 500, Stack: "main.go:1"}); err != nil {
		fail("Error", err)
	} else {
		pass("Error event")
	}

	fmt.Println("\n── Done ─────────────────────────────────────────────────\n")
}
