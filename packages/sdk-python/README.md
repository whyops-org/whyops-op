# `whyops`

Type-safe Python SDK for WhyOps AI agent observability.

## Install

```bash
pip install whyops
```

## Quick start

```python
from whyops import WhyOps

sdk = WhyOps(
    api_key="YOUR_WHYOPS_API_KEY",
    agent_name="support-agent",
    agent_metadata={
        "systemPrompt": "You are a helpful support agent.",
        "tools": [],
    },
)

trace = sdk.trace("session-123")

trace.user_message_sync([
    {"role": "user", "content": "Reset my password."}
])

trace.llm_response_sync(
    "openai/gpt-4o-mini",
    "openai",
    "I can help with that.",
    usage={"promptTokens": 42, "completionTokens": 16, "totalTokens": 58},
    latency_ms=420,
    finish_reason="stop",
)
```

## Proxy mode

```python
from openai import OpenAI
from whyops import WhyOps

sdk = WhyOps(
    api_key="YOUR_WHYOPS_API_KEY",
    agent_name="support-agent",
    agent_metadata={"systemPrompt": "You are a helpful support agent.", "tools": []},
)

trace_id = "session-123"
client = sdk.openai(OpenAI(api_key="YOUR_WHYOPS_API_KEY"))
client.default_headers = {
    **(client.default_headers or {}),
    "X-Trace-ID": trace_id,
    "X-Thread-ID": trace_id,
}
```

If `proxy_base_url` or `analyse_base_url` are omitted, the SDK uses WhyOps hosted defaults.

## Build and publish

```bash
python3 -m build
python3 -m twine upload dist/*
```
