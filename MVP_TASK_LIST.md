# WhyOps: Production Backend Master Plan & Task List

This document defines the comprehensive engineering roadmap to take WhyOps from "Prototype" to "Enterprise Production Ready". It is structured around **Critical User Flows** to ensure end-to-end functionality.

---

## 🏗 System Architecture Upgrades (Foundation)
*Before building complex features, the foundation must support scale, security, and data integrity.*

### 1. Multi-Tenancy & RBAC Schema
**Goal**: Support Organizations, Projects, and granular permissions.
- [ ] **Database Migration: Hierarchy**
    - Create `Organization` table (id, name, billing_id).
    - Create `Project` table (id, org_id, name, settings).
    - Link `User` to `Organization` via `OrganizationMember` (role: owner, admin, member, viewer).
    - Update `ApiKey`, `LLMEvent`, `Provider` to belong to `Project` (not just User).
- [ ] **Middleware: Context Injection**
    - Create `requireProject` middleware that resolves `x-whyops-project-id` header or API key scope.
    - Create `requireRole(role)` middleware for RBAC enforcement.

### 2. Tiered Storage Engine (Hot vs. Cold)
**Goal**: Store massive context windows cheaply (R2/S3) while keeping metadata fast (Postgres).
- [ ] **Shared Storage Service (`@whyops/shared/storage`)**
    - Implement an abstract `StorageProvider` interface.
    - Implement `S3Provider` (compatible with Cloudflare R2 / AWS S3).
- [ ] **Data Pipeline Upgrade**
    - Modify `LLMEvent` model: Add `contextUrl` and `responseUrl` columns.
    - **Logic**: If payload > 4KB:
        1. Upload content to R2 bucket: `projects/{projectId}/traces/{traceId}/{stepId}_context.json`.
        2. Store generated URL in Postgres.
        3. Store only metadata (tokens, model, tool_name) in Postgres.

### 3. Async Event Processing (The "Firehose")
**Goal**: Zero latency impact on the Proxy. Offload analysis to background workers.
- [ ] **Queue Infrastructure**
    - Set up `Redis` container in `docker-compose`.
    - Install `bullmq` in `whyops-analyse`.
- [ ] **Ingestion Pipeline**
    - **Proxy**: Instead of writing to DB directly, push job `event.ingest` to Redis.
    - **Worker (`whyops-analyse`)**:
        - `Processor`: Pull job -> Validate -> Sanitize -> Write to Postgres -> Upload to R2 -> Check Alerts.

---

## 🔄 Flow 1: Enterprise Onboarding & Security
*User Journey: A VP of Engineering invites their team, sets up SSO, and creates a project for their "Research Agent".*

### 1.1 Authentication & SSO
- [ ] **SSO Integration (SAML/OIDC)**
    - Integrate `passport-saml` or a provider like WorkOS/Auth0 for Enterprise Login.
    - Endpoint: `POST /auth/sso/init` (Start login flow).
    - Endpoint: `POST /auth/sso/callback` (Handle IdP response).
- [ ] **Invite System**
    - Endpoint: `POST /orgs/:id/invites` (Send email with magic link).
    - Endpoint: `POST /auth/invites/accept` (Join org).

### 1.2 API Key Management
- [ ] **Scoped API Keys**
    - Update `ApiKey` model to support scopes: `['ingest:write', 'traces:read', 'admin:all']`.
    - Implement Key Rotation: `POST /api-keys/:id/rotate` (Generate new, keep old active for 24h).

---

## ⚡ Flow 2: The "Decision Trace" Loop (Core Product)
*User Journey: A complex "Coder Agent" runs. It receives a vague user prompt, searches Google, reads a file, thinks, and writes code. WhyOps must capture the "WHY".*

### 2.1 Smart Proxy & Interceptors
- [ ] **Universal Stream Handler**
    - Refactor `whyops-proxy` to handle SSE (Server-Sent Events) robustly.
    - **Accumulator**: As chunks flow through, accumulate them in memory to form the full "Response" object for logging, without delaying the stream to the client.
- [ ] **Tool Call Capture**
    - Explicitly parse `tools` and `tool_calls` from OpenAI/Anthropic payloads.
    - Detect "Thought" chains (e.g., CoT blocks in reasoning models).
    - **Tagging**: Mark events as `type: 'decision'` if they involve a Tool Selection or specific Reasoning output.

### 2.2 Trace Context Propagation (Multi-Agent)
- [ ] **Distributed Tracing Headers**
    - Respect `x-trace-id` and `x-parent-span-id` if sent by the agent.
    - If missing, generate `trace_id` at the entry point.
    - Inject `x-whyops-trace-id` into the response headers so the Agent can log it.

### 2.3 Long-Running Session Support
- [ ] **Session/Thread Management**
    - Endpoint: `POST /v1/sessions` (Create a persistent session for a long-running agent).
    - **Heartbeat Monitor**: Allow agents to send "I'm alive" pings. Detect "Silent Death" if no ping > 5 mins.
    - **State Checkpointing**:
        - Endpoint: `POST /v1/sessions/:id/checkpoint`.
        - Stores a full JSON dump of the Agent's memory/state to R2. Used for "Resume" functionality.

---

## 🧠 Flow 3: Deep Debugging & Interpretability
*User Journey: The agent failed 6 hours in. The dev opens WhyOps. They see the exact step where the agent chose "Delete File" instead of "Edit File".*

### 3.1 React Flow Graph API
- [ ] **Graph Generation Endpoint** (`GET /api/visualize/:traceId/graph`)
    - **Logic**: Transform linear `LLMEvent` rows into a DAG (Directed Acyclic Graph).
    - **Nodes**:
        - `UserNode`: The prompt.
        - `ReasoningNode`: The "Thought" process (extracted from CoT).
        - `DecisionNode`: The Tool Call.
        - `ActionNode`: The Tool Result.
    - **Edges**: Connect steps sequentially. Add metadata (latency, cost) to edges.
    - **Status**: Mark nodes Red/Green based on HTTP status or explicit `error` events.

### 3.2 State Inspector & Diff Engine
- [ ] **State Fetcher**
    - Endpoint: `GET /api/events/:eventId/state`.
    - **Hydration**: If data is in R2, fetch and stream it. If in Postgres, return directly.
- [ ] **Context Window Visualizer**
    - Endpoint: `GET /api/events/:eventId/context-analysis`.
    - **Logic**: Calculate token usage per section (System Prompt, History, RAG Context).
    - **Optimization Tip**: Return "Suggested Truncation" if utilization > 80%.
- [ ] **Execution Diff**
    - Endpoint: `POST /api/analyse/diff`.
    - Input: `traceId_A`, `traceId_B`.
    - **Logic**: Compare the sequence of tools used. Identify the *first* point of divergence. Return the diff of the inputs at that divergence point.

---

## 🛡 Flow 4: Proactive Quality Gates
*User Journey: An agent starts looping. WhyOps detects it and kills the run or alerts Slack.*

### 4.1 Real-Time Analyzers (The "Guardians")
- [ ] **The Loop Detector**
    - **Logic**: In the ingestion worker, check the last 5 steps. If `tool_name` and `tool_args` are identical -> Flag as `Loop`.
- [ ] **Constraint Validator**
    - **Schema**: DB table `ProjectConstraints` (e.g., "No tool call to 'exec_shell'", "Max cost $5").
    - **Logic**: On every event, check against active constraints.
    - **Action**: If violation, tag event with `violation: true`.

### 4.2 Alerting System
- [ ] **Notification Channels**
    - DB Table: `AlertConfiguration` (webhook_url, slack_channel_id, events: ['error', 'violation']).
- [ ] **Dispatcher**
    - Background job that watches for `violation: true` events and POSTs to the configured Webhook/Slack.

---

## ⏪ Flow 5: "Fix & Replay" (The Loop Closer)
*User Journey: "This failed. Let me fix the prompt and try exactly this scenario again."*

### 5.1 Test Case Generator
- [ ] **Snapshot Export**
    - Endpoint: `POST /api/traces/:id/export-test-case`.
    - **Logic**: bundle the `SystemPrompt` + `UserPrompt` + `MockedToolOutputs` (from the trace) into a JSON file compatible with a testing framework (like Jest or a custom runner).

### 5.2 Mock Server / Replay Mode
- [ ] **Replay Endpoint**
    - Endpoint: `POST /api/replay/simulate`.
    - **Logic**:
        - Accept a `traceId`.
        - Re-execute the LLM call using the *original* inputs.
        - *Crucial*: If the agent tries to call a tool, return the *recorded* tool output from the trace (don't actually call the API). This ensures deterministic replay.

---

## 🛠 Operational Excellence (Production Requirements)

### Testing & Quality
- [ ] **Integration Test Suite**: Create a test that spins up the full stack, runs a dummy "Agent" script that talks to the Proxy, and asserts that the Trace appears in the DB.
- [ ] **Load Testing**: Use k6/Artillery to flood the Proxy with 1000 req/s. Ensure Redis queues handle the backpressure without dropping requests.

### Infrastructure & DevOps
- [ ] **Database Backup Strategy**: Automated daily pg_dump to S3.
- [ ] **Log Aggregation**: Ensure structured JSON logging (Pino) includes `trace_id` and `span_id` in every log line for correlation in Datadog/CloudWatch.
