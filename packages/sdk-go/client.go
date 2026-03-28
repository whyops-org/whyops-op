// Package whyops is the Go SDK for WhyOps AI agent observability.
//
// Import path: github.com/whyops-org/whyops-op/packages/sdk-go
//
// Quick start:
//
//	sdk := whyops.New(whyops.Config{
//	    APIKey:        os.Getenv("WHYOPS_API_KEY"),
//	    AgentName:     "my-agent",
//	    AgentMetadata: whyops.AgentMetadata{SystemPrompt: "You are helpful."},
//	})
//
//	// Proxy mode
//	httpClient := sdk.ProxyHTTPClient()
//
//	// Manual events mode
//	trace := sdk.Trace("session-abc")
//	trace.UserMessage(ctx, []whyops.MessageItem{{Role: "user", Content: "Hello"}}, whyops.UserMessageOptions{})
package whyops

import (
	"context"
	"strings"
)

const (
	defaultProxyURL   = "https://proxy.whyops.com"
	defaultAnalyseURL = "https://api.whyops.com/api"
)

// Client is the main WhyOps SDK client.
type Client struct {
	apiKey         string
	agentName      string
	agentMetadata  AgentMetadata
	proxyBaseURL   string
	analyseBaseURL string
	registry       *agentRegistry
	http           *httpClient
}

// New creates a new WhyOps client.
func New(cfg Config) *Client {
	proxyURL := defaultProxyURL
	if cfg.ProxyBaseURL != "" {
		proxyURL = strings.TrimRight(cfg.ProxyBaseURL, "/")
	}
	analyseURL := defaultAnalyseURL
	if cfg.AnalyseBaseURL != "" {
		analyseURL = strings.TrimRight(cfg.AnalyseBaseURL, "/")
	}

	c := &Client{
		apiKey:         cfg.APIKey,
		agentName:      cfg.AgentName,
		agentMetadata:  cfg.AgentMetadata,
		proxyBaseURL:   proxyURL,
		analyseBaseURL: analyseURL,
		http:           newHTTPClient(),
	}
	c.registry = newAgentRegistry(cfg.APIKey, proxyURL, analyseURL)
	return c
}

// InitAgent explicitly initialises the agent. This is called automatically
// before the first event — only call directly if you want early registration.
func (c *Client) InitAgent(ctx context.Context) *AgentInfo {
	return c.registry.ensure(ctx, c.agentName, c.agentMetadata)
}

// Trace creates a Trace builder for the given session / conversation ID.
func (c *Client) Trace(traceID string) *Trace {
	return newTrace(
		traceID,
		c.agentName,
		c.apiKey,
		c.analyseBaseURL,
		c.http,
		func(ctx context.Context) {
			c.registry.ensure(ctx, c.agentName, c.agentMetadata)
		},
	)
}
