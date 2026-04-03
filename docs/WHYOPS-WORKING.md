# WhyOps TypeScript SDK — Working Reference

> Analysis of `packages/sdk-typescript` + `https://whyops.com/docs/llms.txt`

---

## Architecture Overview

Two integration modes:

```
Mode 1: PROXY (zero-code, intercepts LLM calls)
  Your App → patchOpenAI(client) → WhyOps Proxy (proxy.whyops.com)
                                       → OpenAI / Anthropic
                                       → Traces auto-captured

Mode 2: MANUAL EVENTS (explicit, full control)
  Your App → whyops.trace(traceId).llmResponse(...) → Analyse API (a.whyops.com)
```

---

## Key File Map

| File | Purpose |
|---|---|
| `packages/sdk-typescript/src/client.ts` | `WhyOps` class, entry point |
| `packages/sdk-typescript/src/trace.ts` | `WhyOpsTrace`, all 9 event methods |
| `packages/sdk-typescript/src/types.ts` | All TypeScript interfaces |
| `packages/sdk-typescript/src/agent.ts` | `AgentRegistry`, init + caching |
| `packages/sdk-typescript/src/proxy.ts` | `patchOpenAI`, `patchAnthropic` |
| `packages/sdk-typescript/src/http.ts` | `post()` with retry/backoff |
| `packages/sdk-typescript/src/config.generated.ts` | URLs, timeouts, endpoints |
| `packages/sdk/CLAUDE.md` | Canonical SDK design spec (all SDKs) |

---

## Configuration

```typescript
interface WhyOpsConfig {
  apiKey: string;
  agentName: string;
  agentMetadata: {
    systemPrompt: string;
    description?: string;
    tools?: Array<{
      name: string;
      description?: string;
      inputSchema?: string;   // JSON string
      outputSchema?: string;  // JSON string
    }>;
  };
  proxyBaseUrl?: string;    // default: https://proxy.whyops.com
  analyseBaseUrl?: string;  // default: https://a.whyops.com/api
}
```

---

## Event Flow (Manual Mode)

```
1. new WhyOps(config)
      ↓ lazy init
2. AgentRegistry.ensure() — POST /entities/init or /v1/agents/init (fallback)
      ↓ caches AgentInfo { agentId, agentVersionId, versionHash }
3. whyops.trace(sessionId)
      ↓ creates WhyOpsTrace bound to traceId + agentName
4. trace.userMessage([{role, content}])           → POST /events/ingest
5. trace.llmResponse(model, provider, content)    → POST /events/ingest
6. trace.toolCallRequest(tool, [{name, args}])    → POST /events/ingest → returns spanId
7. trace.toolCallResponse(tool, spanId, ...)      → POST /events/ingest  ← spanId links these
8. trace.error(msg)                               → POST /events/ingest
```

---

## All 10 Event Types

| Event | Method | Key Fields |
|---|---|---|
| `user_message` | `trace.userMessage()` | `messages: MessageItem[]` |
| `llm_response` | `trace.llmResponse()` | `model`, `provider`, `content`, `toolCalls`, `finishReason`, `usage` |
| `llm_thinking` | `trace.llmThinking()` | `thinking: string` |
| `embedding_request` | `trace.embeddingRequest()` | `inputs: string[]` |
| `embedding_response` | `trace.embeddingResponse()` | `model`, `provider`, `embeddingCount`, `dimensions` |
| `tool_call_request` | `trace.toolCallRequest()` | `tool`, `toolCalls[]` → returns `spanId` |
| `tool_call_response` | `trace.toolCallResponse()` | `tool`, `spanId` (from request), `toolResults` |
| `tool_result` | `trace.toolResult()` | `toolName`, `output` |
| `error` | `trace.error()` | `message`, `status?`, `stack?` |
| `tool_call` | (combined/legacy) | shorthand |

**Critical:** `toolCallRequest` returns a `spanId` — must pass it into `toolCallResponse` to pair them. Backend uses this to link request↔response in the trace DAG.

---

## Shared Event Fields (on every event)

```typescript
traceId        // auto-set by trace()
agentName      // auto-set from config
spanId         // optional, auto-generated if not provided
stepId         // auto-incremented by backend
parentStepId   // resolved by backend (tree structure)
timestamp      // ISO 8601, server default
idempotencyKey // for safe retries
externalUserId // link to your user entities
```

---

## Method Signatures

```typescript
// WhyOps class
new WhyOps(config: WhyOpsConfig)
whyops.initAgent()                                    // Promise<AgentInfo | null>
whyops.trace(traceId: string)                         // WhyOpsTrace
whyops.openai<T>(client: T): T                        // patches client in-place
whyops.anthropic<T>(client: T): T                     // patches client in-place

// WhyOpsTrace class
trace.userMessage(messages, options?)                 // Promise<void>
trace.llmResponse(model, provider, content, options?) // Promise<void>
trace.llmThinking(thinking, options?)                 // Promise<void>
trace.embeddingRequest(inputs, options?)              // Promise<void>
trace.embeddingResponse(model, provider, count, dims, options?) // Promise<void>
trace.toolCallRequest(tool, toolCalls, options?)      // Promise<string>  ← spanId
trace.toolCallResponse(tool, spanId, calls, results, options?) // Promise<void>
trace.toolResult(toolName, output, options?)          // Promise<void>
trace.error(message, options?)                        // Promise<void>
```

---

## Key Type Interfaces

```typescript
interface MessageItem {
  role: string;
  content: string;
}

interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

interface ToolCallPair {
  name: string;
  arguments: Record<string, unknown>;
}

// LLM response content shape
interface LLMResponseContent {
  content?: string | null;
  toolCalls?: Array<{
    id?: string;
    function: { name: string; arguments: string }; // arguments is JSON string
  }>;
  finishReason?: 'stop' | 'tool_calls' | 'max_tokens' | 'error' | string;
}

interface AgentInfo {
  agentId: string;
  agentVersionId: string;
  status: 'created' | 'existing';
  versionHash: string; // SHA-256 prefix of metadata
}
```

---

## HTTP Transport

```
Endpoint base:  https://a.whyops.com/api
Auth header:    Authorization: Bearer {WHYOPS_API_KEY}
Agent header:   X-Agent-Name: {agentName}
Timeout:        15s (AbortSignal.timeout)
Retry on:       429, 500, 502, 503, 504
Backoff:        200ms → 400ms → 800ms (3 attempts max)
Failure mode:   SILENT — logs [whyops] prefix, never throws
```

### Backend Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `a.whyops.com/api/entities/init` | POST | Agent init (primary) |
| `proxy.whyops.com/v1/agents/init` | POST | Agent init (fallback) |
| `a.whyops.com/api/events/ingest` | POST | Ingest events (manual mode) |
| `proxy.whyops.com/v1/chat/completions` | POST | OpenAI-compatible proxy |
| `proxy.whyops.com/messages` | POST | Anthropic-compatible proxy |

---

## Agent Initialization & Versioning

```
POST /entities/init {
  agentName, metadata: { systemPrompt, description, tools }
}
→ { agentId, agentVersionId, status: 'created'|'existing', versionHash }
```

- `versionHash` = SHA-256 of sorted metadata JSON
- Changing `systemPrompt` or tools creates a new `agentVersionId`
- Backend uses `agentVersionId` for version-based perf comparisons
- Init is cached in memory by `agentName + metadataHash` — only runs once per process

---

## Proxy Mode Internals

`patchOpenAI(client)` / `patchAnthropic(client)` mutates the client in-place:

```typescript
// OpenAI
client.baseURL = "https://proxy.whyops.com"
client.apiKey = whyopsApiKey
client.defaultHeaders["Authorization"] = `Bearer ${whyopsApiKey}`
client.defaultHeaders["X-Agent-Name"] = agentName

// Anthropic (uses x-api-key instead)
client.baseURL = "https://proxy.whyops.com"
client.apiKey = whyopsApiKey
client.defaultHeaders["x-api-key"] = whyopsApiKey
client.defaultHeaders["X-Agent-Name"] = agentName
```

Server-side uses **Invisible Signatures** (request fingerprinting) to group API calls into traces without a manual `traceId`.

---

## Server-Side Concepts (from docs)

| Concept | What it is |
|---|---|
| **Decision Graphs** | DAG built from `stepId`/`parentStepId` + span pairs |
| **Trace Inspector** | Step-level payload viewer using the event schemas above |
| **Evaluations** | Aggregated metrics per `agentVersionId` (reliability/cost/latency) |
| **Agent Knowledge Profiles** | Cross-trace aggregation per `agentName` |
| **Invisible Signatures** | Proxy mode fingerprinting to auto-group calls into traces |

---

## SDK Design Rules

- Zero runtime dependencies (native `fetch` only, Node 18+)
- Never throws — all failures are logged and swallowed
- Agent init is lazy — triggered automatically before first event
- Supports `idempotencyKey` for safe retries on any event
- `toolCallRequest` → `toolCallResponse` span pairing is the only stateful pattern
- Proxy patchers never import OpenAI/Anthropic — accept user's existing client instance
