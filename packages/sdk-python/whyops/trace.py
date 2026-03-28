"""
WhyOpsTrace — fluent trace builder.
One method per event type, typed with TypedDicts/Literals.
Provides both sync and async variants for every method.
"""
from __future__ import annotations

import sys
import uuid
from typing import Any, Callable, Coroutine, Optional

from ._config import ENDPOINT_EVENTS_INGEST, LOG_PREFIX
from .http import post_async, post_sync
from .types import (
    AgentMetadata,
    ErrorContent,
    EventOptions,
    EventPayload,
    EventType,
    LLMResponseContent,
    LLMThinkingContent,
    MessageItem,
    TokenUsage,
    ToolCallItem,
    ToolCallPair,
    UserMessageMetadata,
)


def _new_span_id() -> str:
    return str(uuid.uuid4())


class WhyOpsTrace:
    """
    Builder for a single trace (session/conversation).

    Use the *_sync methods in synchronous code, the async methods in async code.
    Both variants are first-class — pick whichever fits your runtime.
    """

    def __init__(
        self,
        trace_id: str,
        agent_name: str,
        api_key: str,
        analyse_base_url: str,
        on_init_sync: Callable[[], None],
        on_init_async: Callable[[], Coroutine[Any, Any, None]],
    ) -> None:
        self._trace_id = trace_id
        self._agent_name = agent_name
        self._api_key = api_key
        self._url = f"{analyse_base_url.rstrip('/')}{ENDPOINT_EVENTS_INGEST}"
        self._on_init_sync = on_init_sync
        self._on_init_async = on_init_async

    # ─── user_message ────────────────────────────────────────────────────────

    def user_message_sync(
        self,
        messages: list[MessageItem],
        *,
        metadata: Optional[UserMessageMetadata] = None,
        **opts: Any,
    ) -> None:
        self._on_init_sync()
        self._send_sync(self._build("user_message", {"messages": messages}, metadata, opts))

    async def user_message(
        self,
        messages: list[MessageItem],
        *,
        metadata: Optional[UserMessageMetadata] = None,
        **opts: Any,
    ) -> None:
        await self._on_init_async()
        await self._send_async(self._build("user_message", {"messages": messages}, metadata, opts))

    # ─── llm_response ────────────────────────────────────────────────────────

    def llm_response_sync(
        self,
        model: str,
        provider: str,
        content: Optional[str] = None,
        *,
        tool_calls: Optional[list[ToolCallItem]] = None,
        finish_reason: Optional[str] = None,
        usage: Optional[TokenUsage] = None,
        latency_ms: Optional[int] = None,
        **opts: Any,
    ) -> None:
        self._on_init_sync()
        self._send_sync(self._build_llm_response(model, provider, content, tool_calls, finish_reason, usage, latency_ms, opts))

    async def llm_response(
        self,
        model: str,
        provider: str,
        content: Optional[str] = None,
        *,
        tool_calls: Optional[list[ToolCallItem]] = None,
        finish_reason: Optional[str] = None,
        usage: Optional[TokenUsage] = None,
        latency_ms: Optional[int] = None,
        **opts: Any,
    ) -> None:
        await self._on_init_async()
        await self._send_async(self._build_llm_response(model, provider, content, tool_calls, finish_reason, usage, latency_ms, opts))

    def _build_llm_response(self, model, provider, content, tool_calls, finish_reason, usage, latency_ms, opts):
        evt_content: dict[str, Any] = {}
        if content is not None:
            evt_content["content"] = content
        if tool_calls:
            evt_content["toolCalls"] = tool_calls
        if finish_reason:
            evt_content["finishReason"] = finish_reason

        meta: dict[str, Any] = {"model": model, "provider": provider}
        if usage:
            meta["usage"] = dict(usage)
        if latency_ms is not None:
            meta["latencyMs"] = latency_ms

        return self._build("llm_response", evt_content, meta, opts)

    # ─── llm_thinking ────────────────────────────────────────────────────────

    def llm_thinking_sync(self, thinking: str, *, signature: Optional[str] = None, **opts: Any) -> None:
        self._on_init_sync()
        self._send_sync(self._build("llm_thinking", {"type": "thinking", "thinking": thinking, **({"signature": signature} if signature else {})}, None, opts))

    async def llm_thinking(self, thinking: str, *, signature: Optional[str] = None, **opts: Any) -> None:
        await self._on_init_async()
        await self._send_async(self._build("llm_thinking", {"type": "thinking", "thinking": thinking, **({"signature": signature} if signature else {})}, None, opts))

    # ─── embedding_request ───────────────────────────────────────────────────

    def embedding_request_sync(self, inputs: list[str], **opts: Any) -> None:
        self._on_init_sync()
        self._send_sync(self._build("embedding_request", {"input": inputs}, None, opts))

    async def embedding_request(self, inputs: list[str], **opts: Any) -> None:
        await self._on_init_async()
        await self._send_async(self._build("embedding_request", {"input": inputs}, None, opts))

    # ─── embedding_response ──────────────────────────────────────────────────

    def embedding_response_sync(
        self,
        model: str,
        provider: str,
        embedding_count: int,
        first_embedding_dimensions: int,
        *,
        total_tokens: Optional[int] = None,
        latency_ms: Optional[int] = None,
        **opts: Any,
    ) -> None:
        self._on_init_sync()
        self._send_sync(self._build_emb_response(model, provider, embedding_count, first_embedding_dimensions, total_tokens, latency_ms, opts))

    async def embedding_response(
        self,
        model: str,
        provider: str,
        embedding_count: int,
        first_embedding_dimensions: int,
        *,
        total_tokens: Optional[int] = None,
        latency_ms: Optional[int] = None,
        **opts: Any,
    ) -> None:
        await self._on_init_async()
        await self._send_async(self._build_emb_response(model, provider, embedding_count, first_embedding_dimensions, total_tokens, latency_ms, opts))

    def _build_emb_response(self, model, provider, count, dims, total_tokens, latency_ms, opts):
        meta: dict[str, Any] = {"model": model, "provider": provider}
        if total_tokens is not None:
            meta["usage"] = {"totalTokens": total_tokens}
        if latency_ms is not None:
            meta["latencyMs"] = latency_ms
        return self._build("embedding_response", {"object": "list", "embeddingCount": count, "firstEmbeddingDimensions": dims, "encodingFormat": "float"}, meta, opts)

    # ─── tool_call_request ───────────────────────────────────────────────────

    def tool_call_request_sync(
        self,
        tool: str,
        tool_calls: list[ToolCallPair],
        *,
        latency_ms: Optional[int] = None,
        requested_at: Optional[str] = None,
        **opts: Any,
    ) -> str:
        """Returns the auto-generated span_id to pass to tool_call_response."""
        self._on_init_sync()
        span_id = opts.get("span_id") or _new_span_id()
        opts["span_id"] = span_id
        meta: dict[str, Any] = {"tool": tool}
        if latency_ms is not None:
            meta["latencyMs"] = latency_ms
        content: dict[str, Any] = {"toolCalls": tool_calls}
        if requested_at:
            content["requestedAt"] = requested_at
        self._send_sync(self._build("tool_call_request", content, meta, opts))
        return span_id

    async def tool_call_request(
        self,
        tool: str,
        tool_calls: list[ToolCallPair],
        *,
        latency_ms: Optional[int] = None,
        requested_at: Optional[str] = None,
        **opts: Any,
    ) -> str:
        await self._on_init_async()
        span_id = opts.get("span_id") or _new_span_id()
        opts["span_id"] = span_id
        meta: dict[str, Any] = {"tool": tool}
        if latency_ms is not None:
            meta["latencyMs"] = latency_ms
        content: dict[str, Any] = {"toolCalls": tool_calls}
        if requested_at:
            content["requestedAt"] = requested_at
        await self._send_async(self._build("tool_call_request", content, meta, opts))
        return span_id

    # ─── tool_call_response ──────────────────────────────────────────────────

    def tool_call_response_sync(
        self,
        tool: str,
        span_id: str,
        tool_calls: list[ToolCallPair],
        tool_results: dict[str, Any],
        *,
        latency_ms: Optional[int] = None,
        responded_at: Optional[str] = None,
        **opts: Any,
    ) -> None:
        self._on_init_sync()
        opts["span_id"] = span_id
        meta: dict[str, Any] = {"tool": tool}
        if latency_ms is not None:
            meta["latencyMs"] = latency_ms
        content: dict[str, Any] = {"toolCalls": tool_calls, "toolResults": tool_results}
        if responded_at:
            content["respondedAt"] = responded_at
        self._send_sync(self._build("tool_call_response", content, meta, opts))

    async def tool_call_response(
        self,
        tool: str,
        span_id: str,
        tool_calls: list[ToolCallPair],
        tool_results: dict[str, Any],
        *,
        latency_ms: Optional[int] = None,
        responded_at: Optional[str] = None,
        **opts: Any,
    ) -> None:
        await self._on_init_async()
        opts["span_id"] = span_id
        meta: dict[str, Any] = {"tool": tool}
        if latency_ms is not None:
            meta["latencyMs"] = latency_ms
        content: dict[str, Any] = {"toolCalls": tool_calls, "toolResults": tool_results}
        if responded_at:
            content["respondedAt"] = responded_at
        await self._send_async(self._build("tool_call_response", content, meta, opts))

    # ─── tool_result ─────────────────────────────────────────────────────────

    def tool_result_sync(self, tool_name: str, output: dict[str, Any], **opts: Any) -> None:
        self._on_init_sync()
        self._send_sync(self._build("tool_result", {"toolName": tool_name, "output": output}, None, opts))

    async def tool_result(self, tool_name: str, output: dict[str, Any], **opts: Any) -> None:
        await self._on_init_async()
        await self._send_async(self._build("tool_result", {"toolName": tool_name, "output": output}, None, opts))

    # ─── error ───────────────────────────────────────────────────────────────

    def error_sync(self, message: str, *, status: Optional[int] = None, stack: Optional[str] = None, **opts: Any) -> None:
        self._on_init_sync()
        content: dict[str, Any] = {"message": message}
        if status is not None:
            content["status"] = status
        if stack:
            content["stack"] = stack
        self._send_sync(self._build("error", content, None, opts))

    async def error(self, message: str, *, status: Optional[int] = None, stack: Optional[str] = None, **opts: Any) -> None:
        await self._on_init_async()
        content: dict[str, Any] = {"message": message}
        if status is not None:
            content["status"] = status
        if stack:
            content["stack"] = stack
        await self._send_async(self._build("error", content, None, opts))

    # ─── Internal ────────────────────────────────────────────────────────────

    def _build(
        self,
        event_type: EventType,
        content: Optional[dict[str, Any]],
        metadata: Optional[dict[str, Any]],
        opts: dict[str, Any],
    ) -> EventPayload:
        payload: EventPayload = {
            "eventType": event_type,
            "traceId": self._trace_id,
            "agentName": self._agent_name,
        }
        if content is not None:
            payload["content"] = content
        if metadata:
            payload["metadata"] = metadata
        if opts.get("span_id"):
            payload["spanId"] = opts["span_id"]
        if opts.get("step_id") is not None:
            payload["stepId"] = opts["step_id"]
        if opts.get("parent_step_id") is not None:
            payload["parentStepId"] = opts["parent_step_id"]
        if opts.get("timestamp"):
            payload["timestamp"] = opts["timestamp"]
        if opts.get("idempotency_key"):
            payload["idempotencyKey"] = opts["idempotency_key"]
        return payload

    def _send_sync(self, payload: EventPayload) -> None:
        try:
            r = post_sync(self._url, dict(payload), {"Authorization": f"Bearer {self._api_key}"})
            if not r.is_success:
                print(f"{LOG_PREFIX} event send failed: HTTP {r.status_code} ({payload['eventType']})", file=sys.stderr)
        except Exception as exc:
            print(f"{LOG_PREFIX} event send error: {exc}", file=sys.stderr)

    async def _send_async(self, payload: EventPayload) -> None:
        try:
            r = await post_async(self._url, dict(payload), {"Authorization": f"Bearer {self._api_key}"})
            if not r.is_success:
                print(f"{LOG_PREFIX} event send failed: HTTP {r.status_code} ({payload['eventType']})", file=sys.stderr)
        except Exception as exc:
            print(f"{LOG_PREFIX} event send error: {exc}", file=sys.stderr)
