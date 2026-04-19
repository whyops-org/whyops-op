package whyops

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
)

// Trace is a builder for a single trace (session / conversation).
// Create one via Client.Trace(traceID).
type Trace struct {
	traceID        string
	agentName      string
	apiKey         string
	analyseBaseURL string
	http           *httpClient
	onInit         func(ctx context.Context)
}

func newTrace(traceID, agentName, apiKey, analyseBaseURL string, http *httpClient, onInit func(ctx context.Context)) *Trace {
	return &Trace{
		traceID:        traceID,
		agentName:      agentName,
		apiKey:         apiKey,
		analyseBaseURL: analyseBaseURL,
		http:           http,
		onInit:         onInit,
	}
}

// ─── UserMessage ──────────────────────────────────────────────────────────────

func (t *Trace) UserMessage(ctx context.Context, messages []MessageItem, opts UserMessageOptions) error {
	t.onInit(ctx)
	var meta map[string]any
	if opts.SystemPrompt != "" || len(opts.Tools) > 0 || len(opts.Params) > 0 {
		meta = make(map[string]any)
		if opts.SystemPrompt != "" {
			meta["systemPrompt"] = opts.SystemPrompt
		}
		if len(opts.Tools) > 0 {
			meta["tools"] = opts.Tools
		}
		if len(opts.Params) > 0 {
			meta["params"] = opts.Params
		}
	}
	return t.send(ctx, t.build(EventTypeUserMessage, map[string]any{"messages": messages}, meta, opts.EventOptions))
}

// ─── LLMResponse ─────────────────────────────────────────────────────────────

func (t *Trace) LLMResponse(ctx context.Context, model, provider, content string, opts LLMResponseOptions) error {
	t.onInit(ctx)
	c := map[string]any{"content": content}
	if len(opts.ToolCalls) > 0 {
		c["toolCalls"] = opts.ToolCalls
	}
	if opts.FinishReason != "" {
		c["finishReason"] = opts.FinishReason
	}

	meta := map[string]any{"model": model, "provider": provider}
	if opts.Usage != nil {
		meta["usage"] = opts.Usage
	}
	if opts.LatencyMs > 0 {
		meta["latencyMs"] = opts.LatencyMs
	}
	return t.send(ctx, t.build(EventTypeLLMResponse, c, meta, opts.EventOptions))
}

// ─── LLMThinking ─────────────────────────────────────────────────────────────

type LLMThinkingOptions struct {
	EventOptions
	Signature string
}

func (t *Trace) LLMThinking(ctx context.Context, thinking string, opts LLMThinkingOptions) error {
	t.onInit(ctx)
	c := map[string]any{"type": "thinking", "thinking": thinking}
	if opts.Signature != "" {
		c["signature"] = opts.Signature
	}
	return t.send(ctx, t.build(EventTypeLLMThinking, c, nil, opts.EventOptions))
}

// ─── EmbeddingRequest ────────────────────────────────────────────────────────

func (t *Trace) EmbeddingRequest(ctx context.Context, inputs []string, opts EventOptions) error {
	t.onInit(ctx)
	return t.send(ctx, t.build(EventTypeEmbeddingRequest, map[string]any{"input": inputs}, nil, opts))
}

// ─── EmbeddingResponse ───────────────────────────────────────────────────────

func (t *Trace) EmbeddingResponse(ctx context.Context, model, provider string, embeddingCount, firstDimensions int, opts EmbeddingResponseOptions) error {
	t.onInit(ctx)
	c := map[string]any{
		"object":                   "list",
		"embeddingCount":           embeddingCount,
		"firstEmbeddingDimensions": firstDimensions,
		"encodingFormat":           "float",
	}
	meta := map[string]any{"model": model, "provider": provider}
	if opts.TotalTokens > 0 {
		meta["usage"] = map[string]int{"totalTokens": opts.TotalTokens}
	}
	if opts.LatencyMs > 0 {
		meta["latencyMs"] = opts.LatencyMs
	}
	return t.send(ctx, t.build(EventTypeEmbeddingResponse, c, meta, opts.EventOptions))
}

// ─── ToolCallRequest ─────────────────────────────────────────────────────────

// ToolCallRequest emits a tool_call_request event and returns the spanID.
// Pass the returned spanID to ToolCallResponse to pair them.
func (t *Trace) ToolCallRequest(ctx context.Context, tool string, toolCalls []ToolCallPair, opts ToolCallRequestOptions) (spanID string, err error) {
	t.onInit(ctx)
	if opts.SpanID == "" {
		opts.SpanID = uuid.NewString()
	}
	spanID = opts.SpanID

	c := map[string]any{"toolCalls": toolCalls}
	if opts.RequestedAt != "" {
		c["requestedAt"] = opts.RequestedAt
	}
	meta := map[string]any{"tool": tool}
	if opts.LatencyMs > 0 {
		meta["latencyMs"] = opts.LatencyMs
	}
	err = t.send(ctx, t.build(EventTypeToolCallRequest, c, meta, opts.EventOptions))
	return
}

// ─── ToolCallResponse ────────────────────────────────────────────────────────

func (t *Trace) ToolCallResponse(ctx context.Context, tool, spanID string, toolCalls []ToolCallPair, toolResults map[string]any, opts ToolCallResponseOptions) error {
	t.onInit(ctx)
	opts.SpanID = spanID
	c := map[string]any{"toolCalls": toolCalls, "toolResults": toolResults}
	if opts.RespondedAt != "" {
		c["respondedAt"] = opts.RespondedAt
	}
	meta := map[string]any{"tool": tool}
	if opts.LatencyMs > 0 {
		meta["latencyMs"] = opts.LatencyMs
	}
	return t.send(ctx, t.build(EventTypeToolCallResponse, c, meta, opts.EventOptions))
}

// ─── ToolResult ──────────────────────────────────────────────────────────────

func (t *Trace) ToolResult(ctx context.Context, toolName string, output map[string]any, opts EventOptions) error {
	t.onInit(ctx)
	return t.send(ctx, t.build(EventTypeToolResult, map[string]any{"toolName": toolName, "output": output}, nil, opts))
}

// ─── Error ───────────────────────────────────────────────────────────────────

func (t *Trace) Error(ctx context.Context, message string, opts ErrorOptions) error {
	t.onInit(ctx)
	c := map[string]any{"message": message}
	if opts.Status != 0 {
		c["status"] = opts.Status
	}
	if opts.Stack != "" {
		c["stack"] = opts.Stack
	}
	return t.send(ctx, t.build(EventTypeError, c, nil, opts.EventOptions))
}

// ─── Internal ─────────────────────────────────────────────────────────────────

func (t *Trace) build(eventType EventType, content, metadata any, opts EventOptions) eventPayload {
	var meta map[string]any
	if metadata != nil {
		if m, ok := metadata.(map[string]any); ok {
			meta = m
		}
	}
	return eventPayload{
		EventType:      eventType,
		TraceID:        t.traceID,
		AgentName:      t.agentName,
		SpanID:         opts.SpanID,
		StepID:         opts.StepID,
		ParentStepID:   opts.ParentStepID,
		Timestamp:      opts.Timestamp,
		Content:        content,
		Metadata:       meta,
		IdempotencyKey: opts.IdempotencyKey,
		ExternalUserID: opts.ExternalUserID,
	}
}

func (t *Trace) send(ctx context.Context, payload eventPayload) error {
	url := t.analyseBaseURL + EndpointEventsIngest
	headers := map[string]string{"Authorization": "Bearer " + t.apiKey}

	status, _, err := t.http.post(ctx, url, payload, headers)
	if err != nil {
		log.Printf("%s event send error (%s): %v", LogPrefix, payload.EventType, err)
		return fmt.Errorf("whyops: send: %w", err)
	}
	if status < 200 || status >= 300 {
		log.Printf("%s event send failed: HTTP %d (%s)", LogPrefix, status, payload.EventType)
		return fmt.Errorf("whyops: HTTP %d", status)
	}
	return nil
}
