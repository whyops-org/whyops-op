package whyops

// EventType is a string enum of all supported event types.
// Constants are defined in config_gen.go (generated from packages/sdk/config.json).
type EventType string

// ─── Agent types ──────────────────────────────────────────────────────────────

// AgentTool describes a single tool available to the agent.
type AgentTool struct {
	Name         string `json:"name"`
	Description  string `json:"description,omitempty"`
	InputSchema  string `json:"inputSchema,omitempty"`  // JSON string, not object
	OutputSchema string `json:"outputSchema,omitempty"` // JSON string, not object
}

// AgentMetadata is sent to the backend on agent initialisation.
type AgentMetadata struct {
	SystemPrompt string      `json:"systemPrompt"`
	Description  string      `json:"description,omitempty"`
	Tools        []AgentTool `json:"tools,omitempty"`
}

// AgentInfo is the response from a successful agent init call.
type AgentInfo struct {
	AgentID        string `json:"agentId"`
	AgentVersionID string `json:"agentVersionId"`
	Status         string `json:"status"` // "created" | "existing"
	VersionHash    string `json:"versionHash"`
}

// ─── Message / content types ──────────────────────────────────────────────────

// MessageItem is a single chat message (role + content).
type MessageItem struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ToolCallFunction holds the name and JSON-encoded arguments of a tool call.
type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON-encoded string
}

// ToolCallItem is an LLM-generated tool call in a response.
type ToolCallItem struct {
	ID       string           `json:"id,omitempty"`
	Function ToolCallFunction `json:"function"`
}

// ToolCallPair is a tool invocation with parsed (not serialised) arguments.
type ToolCallPair struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

// TokenUsage holds prompt caching-aware token counts.
type TokenUsage struct {
	PromptTokens        int `json:"promptTokens,omitempty"`
	CompletionTokens    int `json:"completionTokens,omitempty"`
	TotalTokens         int `json:"totalTokens,omitempty"`
	CacheReadTokens     int `json:"cacheReadTokens,omitempty"`
	CacheCreationTokens int `json:"cacheCreationTokens,omitempty"`
}

// ─── Per-event option structs ─────────────────────────────────────────────────

// EventOptions are optional fields shared by every event.
type EventOptions struct {
	SpanID         string
	StepID         int
	ParentStepID   int
	Timestamp      string // ISO 8601
	IdempotencyKey string
	ExternalUserID string // Your application's user ID (not the WhyOps internal user ID)
}

// UserMessageOptions holds optional metadata for a user_message event.
type UserMessageOptions struct {
	EventOptions
	SystemPrompt string
	Tools        []map[string]string
	Params       map[string]any
}

// LLMResponseOptions holds optional fields for an llm_response event.
type LLMResponseOptions struct {
	EventOptions
	ToolCalls    []ToolCallItem
	FinishReason string
	Usage        *TokenUsage
	LatencyMs    int
}

// EmbeddingResponseOptions holds optional fields for an embedding_response event.
type EmbeddingResponseOptions struct {
	EventOptions
	TotalTokens int
	LatencyMs   int
}

// ToolCallRequestOptions holds optional fields for a tool_call_request event.
type ToolCallRequestOptions struct {
	EventOptions
	RequestedAt string
	LatencyMs   int
}

// ToolCallResponseOptions holds optional fields for a tool_call_response event.
type ToolCallResponseOptions struct {
	EventOptions
	RespondedAt string
	LatencyMs   int
}

// ErrorOptions holds optional fields for an error event.
type ErrorOptions struct {
	EventOptions
	Status int
	Stack  string
}

// ─── Internal event payload ───────────────────────────────────────────────────

type eventPayload struct {
	EventType      EventType      `json:"eventType"`
	TraceID        string         `json:"traceId"`
	AgentName      string         `json:"agentName"`
	SpanID         string         `json:"spanId,omitempty"`
	StepID         int            `json:"stepId,omitempty"`
	ParentStepID   int            `json:"parentStepId,omitempty"`
	Timestamp      string         `json:"timestamp,omitempty"`
	Content        any            `json:"content,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
	IdempotencyKey string         `json:"idempotencyKey,omitempty"`
	ExternalUserID string         `json:"externalUserId,omitempty"`
}

// ─── Client config ────────────────────────────────────────────────────────────

// Config holds the configuration for the WhyOps client.
type Config struct {
	APIKey         string
	AgentName      string
	AgentMetadata  AgentMetadata
	ProxyBaseURL   string // default: from shared SDK config
	AnalyseBaseURL string // default: from shared SDK config
}
