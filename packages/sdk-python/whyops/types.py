"""
All type definitions for the WhyOps Python SDK.
Uses TypedDict + Literal for strict, IDE-friendly types.
"""
from __future__ import annotations

from typing import Any, Literal, Optional, Sequence
from typing_extensions import TypedDict, Required, NotRequired

from ._config import EVENT_TYPES, EventType

# ─── Event type literal ────────────────────────────────────────────────────────

# ─── Shared small types ────────────────────────────────────────────────────────

class MessageItem(TypedDict):
    role: str
    content: str


class ToolCallFunction(TypedDict):
    name: str
    arguments: str  # JSON-encoded string


class ToolCallItem(TypedDict, total=False):
    id: str
    function: Required[ToolCallFunction]


class ToolCallPair(TypedDict):
    name: str
    arguments: dict[str, Any]


class TokenUsage(TypedDict, total=False):
    promptTokens: int
    completionTokens: int
    totalTokens: int
    cacheReadTokens: int
    cacheCreationTokens: int


# ─── Content shapes ────────────────────────────────────────────────────────────

class LLMResponseContent(TypedDict, total=False):
    content: Optional[str]
    toolCalls: list[ToolCallItem]
    finishReason: str


class LLMThinkingContent(TypedDict, total=False):
    type: Required[Literal["thinking"]]
    thinking: Required[str]
    signature: str


class EmbeddingResponseContent(TypedDict):
    object: Literal["list"]
    embeddingCount: int
    firstEmbeddingDimensions: int
    encodingFormat: Literal["float", "base64"]


class ToolCallRequestContent(TypedDict, total=False):
    toolCalls: Required[list[ToolCallPair]]
    requestedAt: str  # ISO 8601


class ToolCallResponseContent(TypedDict, total=False):
    toolCalls: Required[list[ToolCallPair]]
    toolResults: Required[dict[str, Any]]
    respondedAt: str


class ToolResultContent(TypedDict):
    toolName: str
    output: dict[str, Any]


class ErrorContent(TypedDict, total=False):
    message: Required[str]
    status: int
    stack: str


# ─── Metadata shapes ──────────────────────────────────────────────────────────

class LLMResponseMetadata(TypedDict, total=False):
    model: Required[str]    # e.g. "openai/gpt-4o"
    provider: Required[str] # e.g. "openai"
    usage: TokenUsage
    latencyMs: int


class EmbeddingResponseMetadata(TypedDict, total=False):
    model: Required[str]
    provider: Required[str]
    usage: dict[str, int]
    latencyMs: int


class ToolCallMetadata(TypedDict, total=False):
    tool: Required[str]
    latencyMs: int


class UserMessageMetadata(TypedDict, total=False):
    systemPrompt: str
    tools: list[dict[str, str]]
    params: dict[str, Any]


# ─── Agent types ──────────────────────────────────────────────────────────────

class AgentTool(TypedDict, total=False):
    name: Required[str]
    description: str
    inputSchema: str   # JSON string, not dict
    outputSchema: str  # JSON string, not dict


class AgentMetadata(TypedDict, total=False):
    systemPrompt: Required[str]
    description: str
    tools: list[AgentTool]


class AgentInfo(TypedDict):
    agentId: str
    agentVersionId: str
    status: Literal["created", "existing"]
    versionHash: str


# ─── Client config ────────────────────────────────────────────────────────────

class WhyOpsConfig(TypedDict, total=False):
    api_key: Required[str]
    agent_name: Required[str]
    agent_metadata: Required[AgentMetadata]
    proxy_base_url: str
    analyse_base_url: str


# ─── Base event options ───────────────────────────────────────────────────────

class EventOptions(TypedDict, total=False):
    span_id: str
    step_id: int
    parent_step_id: int
    timestamp: str       # ISO 8601
    idempotency_key: str


# ─── Internal event payload (sent to API) ─────────────────────────────────────

class EventPayload(TypedDict, total=False):
    eventType: Required[EventType]
    traceId: Required[str]
    agentName: Required[str]
    spanId: str
    stepId: int
    parentStepId: int
    timestamp: str
    content: Any
    metadata: dict[str, Any]
    idempotencyKey: str
