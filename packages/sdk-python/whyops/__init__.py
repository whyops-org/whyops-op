"""
WhyOps SDK — AI agent observability for Python.

Quick start::

    from whyops import WhyOps

    sdk = WhyOps(
        api_key="wo-...",
        agent_name="my-agent",
        agent_metadata={"systemPrompt": "You are a helpful assistant."},
    )

    # Proxy mode (OpenAI)
    import openai
    client = sdk.openai(openai.OpenAI())

    # Manual events mode
    trace = sdk.trace("session-abc")
    trace.user_message_sync([{"role": "user", "content": "Hello!"}])
"""

from .client import WhyOps
from .trace import WhyOpsTrace
from .types import (
    AgentInfo,
    AgentMetadata,
    AgentTool,
    ErrorContent,
    EventOptions,
    EventType,
    LLMResponseContent,
    LLMThinkingContent,
    MessageItem,
    TokenUsage,
    ToolCallItem,
    ToolCallPair,
    UserMessageMetadata,
)

__all__ = [
    "WhyOps",
    "WhyOpsTrace",
    # types
    "AgentInfo",
    "AgentMetadata",
    "AgentTool",
    "ErrorContent",
    "EventOptions",
    "EventType",
    "LLMResponseContent",
    "LLMThinkingContent",
    "MessageItem",
    "TokenUsage",
    "ToolCallItem",
    "ToolCallPair",
    "UserMessageMetadata",
]

__version__ = "0.1.0"
