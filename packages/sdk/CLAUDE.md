# WhyOps SDK — Design Document & Implementation Reference

This file is the single source of truth for anyone building or modifying a WhyOps SDK.
Read it fully before touching any SDK package.

---

## What the SDKs do

WhyOps observes AI agents. The SDKs wrap the two integration paths:

1. **Proxy mode** — point the user's existing OpenAI/Anthropic client at the WhyOps proxy.
   WhyOps intercepts every LLM call automatically. Zero event code from the user.

2. **Manual events mode** — the user emits structured events directly to the analyse API.
   Used when the agent has non-LLM steps (tool execution, retrieval, custom logic) or
   when the user cannot use the proxy (serverless constraints, custom providers, etc.).

Both modes require an agent to be initialised once. Both are first-class in every SDK.

---

## Monorepo locations

```
packages/
  sdk/
    CLAUDE.md                ← this file
    config.json              ← canonical shared SDK config source
  sdk-typescript/            ← @whyops/sdk (npm)
  sdk-python/                ← whyops (PyPI)
  sdk-go/                    ← github.com/whyops-org/whyops-op/packages/sdk-go
```

---

## Backend endpoints (source of truth)

### Proxy service (`WHYOPS_PROXY_URL`, default `https://proxy.whyops.com`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/agents/init` | Register or update agent version |
| POST | `/v1/chat/completions` | OpenAI-compatible LLM proxy |
| POST | `/v1/responses` | OpenAI Responses API proxy |
| POST | `/messages` | Anthropic-compatible LLM proxy |
| POST | `/v1/embeddings` | Embeddings proxy |

All proxy requests require:
- `Authorization: Bearer <WHYOPS_API_KEY>`
- `X-Agent-Name: <agentName>` (on LLM calls)
- `X-Trace-ID: <traceId>` (optional — for explicit trace linking)

### Analyse service (`WHYOPS_ANALYSE_URL`, default `https://a.whyops.com/api`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/entities/init` | Register agent (same as proxy `/v1/agents/init`) |
| POST | `/events/ingest` | Emit one or multiple events (queued) |
| POST | `/events` | Emit one event (synchronous) |
| POST | `/events/tool-result` | Shorthand for `tool_call_response` |

All analyse requests require:
- `Authorization: Bearer <WHYOPS_API_KEY>`

---

## Agent init

Must be called once per agent name. Safe to call on every startup — the backend
deduplicates via metadata hash.

### Request

```typescript
{
  agentName: string;           // stable identifier, 1–255 chars
  metadata: {
    systemPrompt: string;      // required
    description?: string;
    tools?: Array<{
      name: string;
      description?: string;
      inputSchema?: string;    // JSON string, NOT an object
      outputSchema?: string;   // JSON string, NOT an object
    }>;
  };
}
```

### Response

```typescript
{
  success: boolean;
  agentId: string;             // UUID
  agentVersionId: string;      // UUID
  status: 'created' | 'existing';
  versionHash: string;         // 32-char SHA-256 prefix
}
```

### SDK behaviour
- Lazy: called automatically before the first event or LLM call.
- Cached in memory. Re-init only if `agentName` or `metadata` object reference changes.
- If init fails, log `[whyops] agent init failed` and continue — do not throw.

---

## Event types — complete type-safe schema

### Base fields (all events)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `eventType` | `EventType` enum | **yes** | see enum below |
| `traceId` | string (1–128) | **yes** | user-supplied session/conversation ID |
| `agentName` | string (1–255) | **yes** | must match init |
| `spanId` | string (1–128) | no | auto-generated UUID if omitted; use same ID for request+response pair |
| `stepId` | integer ≥ 1 | no | auto-incremented by backend if omitted |
| `parentStepId` | integer ≥ 1 | no | previous step; auto-resolved by backend |
| `timestamp` | ISO 8601 string | no | defaults to server time |
| `content` | any | no | event payload (typed per event, see below) |
| `metadata` | object | no | context/metrics (typed per event, see below) |
| `idempotencyKey` | string (1–128) | no | for retry safety |

### EventType enum

```
user_message
llm_response
llm_thinking
embedding_request
embedding_response
tool_call
tool_call_request
tool_call_response
tool_result
error
```

---

### Per-event content + metadata contracts

#### `user_message`
```typescript
content: Array<{ role: string; content: string }>   // message history
metadata?: {
  systemPrompt?: string;
  tools?: Array<{ name: string }>;
  params?: { temperature?: number; [key: string]: unknown };
}
```
*No required metadata fields.*

---

#### `llm_response`
```typescript
content: {
  content?: string | null;
  toolCalls?: Array<{
    id?: string;
    function: { name: string; arguments: string };
  }>;
  finishReason?: 'stop' | 'tool_calls' | 'max_tokens' | 'error' | string;
}
metadata: {
  model: string;      // REQUIRED — e.g. "openai/gpt-4o"
  provider: string;   // REQUIRED — e.g. "openai"
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
  latencyMs?: number;
}
```
**`metadata.model` and `metadata.provider` are required.** Backend returns 400 without them.

---

#### `llm_thinking`
```typescript
content: {
  type: 'thinking';
  thinking: string;
  signature?: string;
}
metadata?: Record<string, unknown>
```
*No required metadata fields.*

---

#### `embedding_request`
```typescript
content: {
  input: string[];
}
metadata?: Record<string, unknown>
```
*No required metadata fields.*

---

#### `embedding_response`
```typescript
content: {
  object: 'list';
  embeddingCount: number;
  firstEmbeddingDimensions: number;
  encodingFormat: 'float' | 'base64';
}
metadata: {
  model: string;      // REQUIRED
  provider: string;   // REQUIRED
  usage?: { totalTokens?: number };
  latencyMs?: number;
}
```
**`metadata.model` and `metadata.provider` are required.**

---

#### `tool_call_request`
```typescript
content: {
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  requestedAt?: string;   // ISO 8601
}
metadata: {
  tool: string;           // REQUIRED — tool name
  latencyMs?: number;
}
```
**`metadata.tool` is required.** Backend returns 400 without it.

---

#### `tool_call_response`
```typescript
content: {
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  toolResults: Record<string, unknown>;
  respondedAt?: string;   // ISO 8601
}
metadata: {
  tool: string;           // REQUIRED
  latencyMs?: number;
}
```
**`metadata.tool` is required.**

---

#### `tool_call` (legacy — wraps request + response)
```typescript
content: {
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  toolResults: Record<string, unknown>;
}
metadata: {
  tool?: string;
}
```
Backend splits this into `tool_call_request` + `tool_call_response` automatically.
Prefer `tool_call_request` / `tool_call_response` pair for proper span pairing.

---

#### `tool_result`
```typescript
content: {
  toolName: string;
  output: Record<string, unknown>;
}
metadata?: Record<string, unknown>
```
*No required metadata fields.*

---

#### `error`
```typescript
content: {
  message: string;
  status?: number;
  stack?: string;
}
metadata?: Record<string, unknown>
```
*No required metadata fields.*

---

## Type safety rules for SDK implementation

1. **Every event type must be a distinct overloaded/overridden method**, not a generic
   `sendEvent(type, content, metadata)`. The user must get IDE autocomplete and type errors
   for wrong field combinations.

2. **Required fields must be non-optional in the method signature.** If `metadata.model`
   is required for `llm_response`, the SDK method must accept `model: string` as a
   direct required parameter, not buried inside an optional `metadata` object.

3. **Content fields should be flattened where natural.** Users should not need to wrap
   everything in `{ content: { ... } }`.

4. **The `traceId` is set once per trace object**, not repeated on every event call.

5. **Idiomatic per language:**
   - TypeScript: discriminated union types + method overloads
   - Python: TypedDict + Literal types + overloads (typing_extensions)
   - Go: struct types + method per event type (no interface{})

---

## SDK client interface (all languages)

```
WhyOps(config)
  .initAgent(agentName, metadata) → AgentInfo   # usually called automatically
  .trace(traceId) → Trace

Trace
  .userMessage(messages, options?)
  .llmResponse(model, provider, content, options?)
  .llmThinking(thinking, options?)
  .embeddingRequest(inputs, options?)
  .embeddingResponse(model, provider, content, options?)
  .toolCallRequest(tool, toolCalls, options?)
  .toolCallResponse(tool, toolCalls, results, options?)
  .toolResult(toolName, output, options?)
  .error(message, options?)
```

Proxy helpers (separate from trace):
```
WhyOps
  .openai(existingClient) → patched OpenAI client
  .anthropic(existingClient) → patched Anthropic client
```

---

## Error handling contract

- **Never throw** into user code from a background event send.
- Log failures to stderr with prefix `[whyops]`.
- On network error: retry up to 3 times with exponential backoff (200ms, 400ms, 800ms)
  for 429 and 5xx only. Do not retry 4xx (except 429).
- If all retries fail: log error, continue. The agent must not crash due to observability.
- Agent init failure is the only case where the SDK may surface an error — and only if
  the user explicitly calls `initAgent()`. Lazy init failures are logged only.

---

## Shared config rule

There is exactly one source of truth for shared SDK constants:

`packages/sdk/config.json`

Do not duplicate default URLs, endpoint paths, retry settings, header names, event type
lists, or logging prefixes by hand inside any SDK package.

Instead:

- Edit `packages/sdk/config.json`
- Run `npm run sync:sdk-config`
- Commit the generated artifacts

Generated artifacts:

- TypeScript: `packages/sdk-typescript/src/config.generated.ts`
- Python: `packages/sdk-python/whyops/_config_gen.py`
- Go: `packages/sdk-go/config_gen.go`

Why this exists:

- The repo keeps one canonical config file.
- Published SDK packages must not read `../../sdk/config.json` at runtime.
- Generated typed files keep packaging clean while preserving one source of truth.

---

## Zero-dependency rule

| SDK | Allowed runtime deps |
|-----|---------------------|
| TypeScript | none (native `fetch`) |
| Python | `httpx>=0.27` only (supports sync + async) |
| Go | stdlib only |

Do not add OpenAI/Anthropic SDKs as dependencies. The proxy wrappers accept the user's
existing client instance and patch it — they do not import the SDK themselves.

---

## File structure — TypeScript (`packages/sdk-typescript/`)

```
src/
  config.ts        # thin wrapper around generated config exports
  config.generated.ts
  types.ts         # all types: EventType, event content/metadata interfaces,
                   # AgentMetadata, AgentInfo, WhyOpsConfig
  client.ts        # WhyOps class — config, lazy init, .trace(), .openai(), .anthropic()
  trace.ts         # WhyOpsTrace class — one method per event type
  agent.ts         # initAgent() — HTTP call + caching logic
  http.ts          # fetch wrapper with retry/backoff
  proxy.ts         # openai() and anthropic() client patchers
index.ts           # re-exports: WhyOps, WhyOpsTrace, all types
package.json
tsconfig.json
README.md
```

## File structure — Python (`packages/sdk-python/`)

```
whyops/
  _config.py       # thin wrapper around generated config exports
  _config_gen.py
  __init__.py      # re-exports: WhyOps, WhyOpsTrace, all types
  types.py         # TypedDicts, Literals, dataclasses for all event shapes
  client.py        # WhyOps class
  trace.py         # WhyOpsTrace class — sync + async versions of each method
  agent.py         # init_agent() — sync + async
  http.py          # httpx transport with retry
  proxy.py         # openai() and anthropic() patchers
pyproject.toml
README.md
```

## File structure — Go (`packages/sdk-go/`)

```
client.go          # WhyOps struct + New() + Trace() + OpenAITransport()
config_gen.go      # generated from packages/sdk/config.json
trace.go           # Trace struct — one method per event type
agent.go           # InitAgent() + caching
http.go            # doWithRetry() using net/http
proxy.go           # http.RoundTripper that injects headers
types.go           # all types: event param structs
go.mod             # module: github.com/whyops-org/whyops-op/packages/sdk-go
README.md
```

---

## Versioning and publishing

- TypeScript: semantic versioning, published to npm as `@whyops/sdk`
- Python: semantic versioning, published to PyPI as `whyops`
- Go: semantic versioning via git tags `packages/sdk-go/v0.1.0`, module `github.com/whyops-org/whyops-op/packages/sdk-go`

Start all at `v0.1.0`. Breaking changes bump minor until `v1.0.0`.

---

## What NOT to build in v1

- Framework integrations (Vercel AI SDK, LangChain) — separate packages, later
- Streaming event support — events are fire-and-forget in v1
- Batch/bulk event sending — backend already handles arrays, SDK sends one at a time
- Client-side sampling — leave that to the backend
- Any UI or dashboard tooling

---

## Adding a new event type (checklist)

When the backend adds a new event type:

1. Add to `EventType` enum in all three SDKs
2. Define `content` and `metadata` interfaces/TypedDicts/structs
3. Add method to `Trace` class in all three SDKs
4. Update this CLAUDE.md with the new event's schema
5. Add example to README of each SDK
