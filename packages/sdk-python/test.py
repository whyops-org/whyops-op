"""
WhyOps Python SDK — integration test (sync + async)
Run: python test.py
"""
import asyncio
import os
import sys
import time

# Allow running from package dir without install
sys.path.insert(0, ".")
import ssl; ssl._create_default_https_context = ssl._create_unverified_context  # noqa: E402

from whyops import WhyOps

API_KEY = os.environ.get("WHYOPS_SDK_TEST_API_KEY")
PROXY_URL = os.environ.get("WHYOPS_SDK_TEST_PROXY_URL")
ANALYSE_URL = os.environ.get("WHYOPS_SDK_TEST_ANALYSE_URL")
AGENT_NAME = os.environ.get("WHYOPS_SDK_TEST_AGENT_NAME", "sdk-ts-test-agent")

if not API_KEY:
    raise RuntimeError("Set WHYOPS_SDK_TEST_API_KEY to run the integration test.")

sdk = WhyOps(
    api_key=API_KEY,
    agent_name=AGENT_NAME,
    agent_metadata={
        "systemPrompt": "You are a test agent for the WhyOps Python SDK.",
        "tools": [],
    },
    **({"proxy_base_url": PROXY_URL} if PROXY_URL else {}),
    **({"analyse_base_url": ANALYSE_URL} if ANALYSE_URL else {}),
)


def p(ok: bool, msg: str, err=None):
    icon = "✓" if ok else "✗"
    print(f"  {icon} {msg}", f"— {err}" if err else "")


# ─── Sync tests ───────────────────────────────────────────────────────────────

def test_sync():
    print("\n── Python SDK — sync ────────────────────────────────────────")

    print("\n[1] Agent init (sync)")
    try:
        info = sdk.init_agent_sync()
        p(bool(info and info.get("agentId")), f"init ok status={info['status']} agentId={info['agentId'][:8]}…")
    except Exception as e:
        p(False, "init", e)

    trace_id = f"py-sdk-sync-{int(time.time())}"
    print(f"\n[2] Manual events sync (traceId={trace_id})")
    trace = sdk.trace(trace_id)

    try:
        trace.user_message_sync([{"role": "user", "content": "What is the capital of France?"}])
        p(True, "user_message")
    except Exception as e:
        p(False, "user_message", e)

    try:
        span_id = trace.tool_call_request_sync(
            "search",
            [{"name": "search", "arguments": {"query": "capital of France"}}],
            latency_ms=30,
        )
        p(True, f"tool_call_request spanId={span_id[:8]}…")

        trace.tool_call_response_sync(
            "search", span_id,
            [{"name": "search", "arguments": {"query": "capital of France"}}],
            {"result": "Paris"},
            latency_ms=95,
        )
        p(True, "tool_call_response")
    except Exception as e:
        p(False, "tool call pair", e)

    try:
        trace.llm_response_sync(
            "openai/gpt-4o", "openai",
            "The capital of France is Paris.",
            usage={"promptTokens": 22, "completionTokens": 9, "totalTokens": 31},
            latency_ms=560,
            finish_reason="stop",
        )
        p(True, "llm_response")
    except Exception as e:
        p(False, "llm_response", e)

    try:
        trace.llm_thinking_sync("Checking geography facts…", signature="sig_test")
        p(True, "llm_thinking")
    except Exception as e:
        p(False, "llm_thinking", e)

    try:
        trace.embedding_request_sync(["capital of France", "Paris geography"])
        p(True, "embedding_request")
    except Exception as e:
        p(False, "embedding_request", e)

    try:
        trace.embedding_response_sync("openai/text-embedding-3-small", "openai", 2, 1536, total_tokens=6, latency_ms=88)
        p(True, "embedding_response")
    except Exception as e:
        p(False, "embedding_response", e)

    try:
        trace.tool_result_sync("search", {"result": "Paris"})
        p(True, "tool_result")
    except Exception as e:
        p(False, "tool_result", e)

    try:
        trace.error_sync("Simulated error for test", status=500, stack="Traceback: test.py:1")
        p(True, "error event")
    except Exception as e:
        p(False, "error", e)


# ─── Async tests ──────────────────────────────────────────────────────────────

async def test_async():
    print("\n── Python SDK — async ───────────────────────────────────────")

    print("\n[3] Agent init (async)")
    try:
        info = await sdk.init_agent()
        p(bool(info and info.get("agentId")), f"init ok status={info['status']} agentId={info['agentId'][:8]}…")
    except Exception as e:
        p(False, "init", e)

    trace_id = f"py-sdk-async-{int(time.time())}"
    print(f"\n[4] Manual events async (traceId={trace_id})")
    trace = sdk.trace(trace_id)

    try:
        await trace.user_message([{"role": "user", "content": "Async hello!"}])
        p(True, "user_message")
    except Exception as e:
        p(False, "user_message", e)

    try:
        span_id = await trace.tool_call_request("search", [{"name": "search", "arguments": {"q": "test"}}], latency_ms=20)
        p(True, f"tool_call_request spanId={span_id[:8]}…")
        await trace.tool_call_response("search", span_id, [{"name": "search", "arguments": {"q": "test"}}], {"result": "ok"}, latency_ms=70)
        p(True, "tool_call_response")
    except Exception as e:
        p(False, "tool call pair", e)

    try:
        await trace.llm_response("anthropic/claude-3-5-sonnet-20241022", "anthropic", "Async response!", latency_ms=310, finish_reason="stop")
        p(True, "llm_response")
    except Exception as e:
        p(False, "llm_response", e)

    try:
        await trace.error("Async simulated error", status=503)
        p(True, "error event")
    except Exception as e:
        p(False, "error", e)

    print("\n── Done ─────────────────────────────────────────────────────\n")


if __name__ == "__main__":
    # Patch httpx to skip TLS verification (same as NODE_TLS_REJECT_UNAUTHORIZED=0)
    import httpx
    _orig_post = httpx.post
    _orig_client = httpx.AsyncClient

    def _patched_post(url, **kw):
        kw.setdefault("verify", False)
        return _orig_post(url, **kw)

    class _PatchedClient(httpx.AsyncClient):
        def __init__(self, **kw):
            kw.setdefault("verify", False)
            super().__init__(**kw)

    httpx.post = _patched_post
    httpx.AsyncClient = _PatchedClient

    import warnings
    warnings.filterwarnings("ignore")

    test_sync()
    asyncio.run(test_async())
