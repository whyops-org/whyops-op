# WhyOps - AI Agent Observability & Evaluation Platform

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7%2B-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)

**Trace every agent run, inspect failures, and turn production traffic into better prompts, tests, and shipping decisions.**

[Getting Started](#-quick-start) · [Product Preview](#-product-preview) · [Architecture](#-architecture) · [License](#-license)

</div>

<p align="center">
  <img src=".github/assets/readme/analysis-hero.webp" alt="WhyOps analysis dashboard showing dimension scores, findings, and issue severity" width="100%" />
</p>

<p align="center">
  <sub>Use WhyOps with direct event ingestion or via an OpenAI and Anthropic compatible proxy.</sub>
</p>

---

## 📋 Table of Contents

<details open>
<summary><strong>Click to expand/collapse</strong></summary>

1. [Overview](#-overview)
2. [Product Preview](#-product-preview)
3. [Architecture](#-architecture)
4. [Quick Start](#-quick-start)
5. [Project Structure](#-project-structure)
6. [Backend Services](#-backend-services)
7. [Frontend Application](#-frontend-application)
8. [Database Schema](#-database-schema)
9. [API Reference](#-api-reference)
10. [Event System](#-event-system)
11. [LLM Judge System](#-llm-judge-system)
12. [Configuration](#-configuration)
13. [Deployment](#-deployment)
14. [Development](#-development)
15. [License](#-license)

</details>

---

## 🎯 Overview

WhyOps is a comprehensive observability platform for AI agents that provides:

| Feature | Description |
|---------|-------------|
| **Trace Collection** | Capture every LLM interaction, tool call, and user message |
| **Agent Monitoring** | Real-time dashboards for agent performance and reliability |
| **LLM-Powered Analysis** | Multi-dimensional evaluation using GPT-4/Claude judges |
| **Eval Generation** | Automatically generate test cases from production traces |
| **Cost Tracking** | Token usage and latency metrics per agent/version |

## ✨ Product Preview

<table>
  <tr>
    <td width="68%">
      <img src=".github/assets/readme/analysis-dashboard.png" alt="WhyOps analysis dashboard with scores, issue counts, and findings strips" width="100%" />
    </td>
    <td width="32%">
      <img src=".github/assets/readme/settings-api-keys.webp" alt="WhyOps settings screen showing API keys and ingestion endpoints" width="100%" />
    </td>
  </tr>
  <tr>
    <td valign="top">
      <strong>Inspect what actually broke.</strong><br />
      Review step correctness, tool choice, prompt quality, cost efficiency, and findings from one analysis view instead of jumping between logs.
    </td>
    <td valign="top">
      <strong>Onboard agents quickly.</strong><br />
      Generate API keys, copy ingestion endpoints, and connect SDKs without leaving the dashboard.
    </td>
  </tr>
</table>

### Why Teams Fork WhyOps

- Run it as a full stack observability workspace instead of stitching together proxy logs, evals, and dashboards by hand.
- Ingest data through manual events or through the WhyOps proxy, depending on how invasive you want instrumentation to be.
- Extend one monorepo that already contains the web app, backend services, and SDK packages for TypeScript, Python, and Go.

### Key Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                        WHYOPS PLATFORM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   PROXY     │    │  ANALYSE    │    │    AUTH     │        │
│  │  :8080      │    │   :8081     │    │   :8082     │        │
│  │             │    │             │    │             │        │
│  │ OpenAI API  │    │ Event       │    │ Better Auth │        │
│  │ Anthropic   │───▶│ Processing  │    │ GitHub/Google OAuth │
│  │ Streaming   │    │ LLM Judges  │    │ Session Mgmt│        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                   │                   │              │
│         └───────────────────┼───────────────────┘              │
│                             │                                  │
│                    ┌────────▼────────┐                        │
│                    │    PostgreSQL   │                        │
│                    │    + Redis      │                        │
│                    └─────────────────┘                        │
│                             │                                  │
│                    ┌────────▼────────┐                        │
│                    │   Next.js App   │                        │
│                    │     :3000       │                        │
│                    └─────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗 Architecture

### Microservices Architecture

| Service | Port | Description | Tech Stack |
|---------|------|-------------|------------|
| **whyops-proxy** | 8080 | LLM API proxy with streaming | Hono, OpenAI SDK, Anthropic SDK |
| **whyops-analyse** | 8081 | Event processing & analysis | Hono, LangChain, Redis Streams |
| **whyops-auth** | 8082 | Authentication & user management | Hono, Better Auth, Kysely |
| **app** | 3000 | Web dashboard | Next.js 16, React 19, Tailwind CSS 4 |
| **shared** | - | Shared models & utilities | Sequelize, Zod, Pino |

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           EVENT INGESTION FLOW                           │
└──────────────────────────────────────────────────────────────────────────┘

     Your AI Agent                WhyOps Proxy              Redis Stream
    ┌───────────┐              ┌───────────┐            ┌───────────┐
    │           │   POST /v1   │           │  XADD     │           │
    │  OpenAI   │─────────────▶│  Proxy    │──────────▶│  Events   │
    │   Call    │   Streaming  │  Service  │           │  Stream   │
    │           │◀─────────────│           │           │           │
    └───────────┘   Response   └───────────┘           └─────┬─────┘
                                                              │
                                                              │ XREADGROUP
                                                              ▼
                    ┌─────────────────────────────────────────────────┐
                    │              ANALYSE SERVICE                     │
                    │  ┌─────────────────────────────────────────┐    │
                    │  │          Events Queue Worker            │    │
                    │  │  • Redis Streams Consumer Group         │    │
                    │  │  • Batch Processing (100 msg/batch)     │    │
                    │  │  • Automatic Retry (5 max)              │    │
                    │  │  • Dead Letter Queue (DLQ)              │    │
                    │  └─────────────────────────────────────────┘    │
                    │                      │                          │
                    │                      ▼                          │
                    │  ┌─────────────────────────────────────────┐    │
                    │  │          Event Service                  │    │
                    │  │  • Parse event type                     │    │
                    │  │  • Create/update trace                  │    │
                    │  │  • Link to agent/entity                 │    │
                    │  │  • Calculate latency/tokens             │    │
                    │  └─────────────────────────────────────────┘    │
                    │                      │                          │
                    │                      ▼                          │
                    │  ┌─────────────────────────────────────────┐    │
                    │  │          PostgreSQL Database            │    │
                    │  │  traces, trace_events, agents,          │    │
                    │  │  entities, agent_analysis_runs          │    │
                    │  └─────────────────────────────────────────┘    │
                    └─────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required
node --version  # v22.0.0+
npm --version   # v10.0.0+

# Services
postgres --version  # v14+
redis-cli --version # v7+
```

### Installation

<details>
<summary><strong>1. Clone & Install</strong></summary>

```bash
# Clone the repository
git clone https://github.com/whyops-org/whyops-op.git
cd whyops-op

# Install dependencies (uses nested install strategy)
npm ci
```

</details>

<details>
<summary><strong>2. Configure Environment</strong></summary>

```bash
# Copy example environment
cp .env.example .env

# Edit with your values
vim .env
```

**Minimal Required Configuration:**

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whyops

# Redis
REDIS_URL=rediss://your-redis-host:6379

# Auth
BETTER_AUTH_SECRET=your-secret-min-32-characters-long
BETTER_AUTH_URL=http://localhost:8082

# LLM Judge (via LiteLLM proxy)
JUDGE_LLM_BASE_URL=https://your-litellm-proxy.com/v1
JUDGE_LLM_API_KEY=sk-your-key
JUDGE_LLM_MODEL=azure/gpt-4.1
```

</details>

<details>
<summary><strong>3. Initialize Database</strong></summary>

```bash
# Run migrations
npm run db:migrate

# (Optional) Seed demo data
npm run db:seed
```

</details>

<details>
<summary><strong>4. Start Development Servers</strong></summary>

```bash
# Start all services concurrently
npm run dev

# Or start individually:
npm run dev:proxy     # Proxy on :8080
npm run dev:analyse   # Analyse on :8081
npm run dev:auth      # Auth on :8082
npm run dev:app       # Frontend on :3000
```

</details>

### Verify Installation

```bash
# Check service health
curl http://localhost:8080/health  # Proxy
curl http://localhost:8081/api/health  # Analyse
curl http://localhost:8082/health  # Auth

# Open dashboard
open http://localhost:3000
```

---

## 📁 Project Structure

```
whyops-op/
├── apps/
│   ├── app/                          # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages
│   │   │   │   ├── (authenticated)/  # Protected routes
│   │   │   │   │   ├── agents/       # Agent pages
│   │   │   │   │   │   ├── [agentId]/
│   │   │   │   │   │   │   ├── page.tsx       # Agent detail
│   │   │   │   │   │   │   └── traces/
│   │   │   │   │   │   │       └── [traceId]/page.tsx
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── traces/
│   │   │   │   ├── onboarding/
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── agents/           # Agent components
│   │   │   │   │   ├── agents-table.tsx
│   │   │   │   │   ├── agent-details-page.tsx
│   │   │   │   │   ├── analysis/     # Analysis components
│   │   │   │   │   └── evals/        # Evaluation components
│   │   │   │   ├── traces/           # Trace visualization
│   │   │   │   │   ├── trace-canvas.tsx
│   │   │   │   │   ├── judge/        # Judge scoring UI
│   │   │   │   │   └── custom-nodes.tsx
│   │   │   │   ├── ui/               # shadcn/ui components
│   │   │   │   └── layout/
│   │   │   ├── stores/               # Zustand stores
│   │   │   │   ├── agentsStore.ts
│   │   │   │   ├── agentAnalysisStore.ts
│   │   │   │   ├── threadsStore.ts
│   │   │   │   └── ...
│   │   │   ├── lib/
│   │   │   │   └── api-client.ts     # Axios instance
│   │   │   └── constants/
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   ├── whyops-proxy/                 # LLM Proxy Service
│   │   ├── src/
│   │   │   ├── index.ts              # Server entry
│   │   │   ├── routes/
│   │   │   │   ├── openai.ts         # /v1/chat/completions
│   │   │   │   ├── anthropic.ts      # /v1/messages
│   │   │   │   └── agents.ts         # Agent-specific routes
│   │   │   ├── services/
│   │   │   │   ├── proxy-routing.ts  # Provider resolution
│   │   │   │   └── analyse.ts        # Event logging
│   │   │   └── middleware/
│   │   │       ├── rateLimit.ts
│   │   │       └── requestLog.ts
│   │   └── package.json
│   │
│   ├── whyops-analyse/               # Analysis Service
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── events.ts         # Event ingestion
│   │   │   │   ├── threads.ts        # Trace listing
│   │   │   │   ├── analytics.ts      # Dashboard stats
│   │   │   │   ├── agent-analyses.ts # Analysis runs
│   │   │   │   └── eval-generation.ts
│   │   │   ├── controllers/
│   │   │   │   ├── event.controller.ts
│   │   │   │   └── thread.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── event.service.ts
│   │   │   │   ├── agent-analysis.service.ts  # ~1000 lines
│   │   │   │   ├── events-queue.service.ts    # Redis worker
│   │   │   │   ├── judge.service.ts
│   │   │   │   └── eval/
│   │   │   │       ├── eval-generation.service.ts
│   │   │   │       └── knowledge-builder.ts
│   │   │   ├── langchain/            # LLM Judge Chains
│   │   │   │   ├── config.ts
│   │   │   │   ├── chains/
│   │   │   │   │   ├── agent-dimension-analysis.chain.ts
│   │   │   │   │   ├── agent-synthesis.chain.ts
│   │   │   │   │   ├── step-correctness.chain.ts
│   │   │   │   │   ├── tool-choice.chain.ts
│   │   │   │   │   ├── prompt-quality.chain.ts
│   │   │   │   │   └── eval-generation.chain.ts
│   │   │   │   ├── prompts/
│   │   │   │   └── schemas/
│   │   │   └── parsers/              # Response parsers
│   │   │       ├── openai.ts
│   │   │       └── anthropic.ts
│   │   └── package.json
│   │
│   └── whyops-auth/                  # Authentication Service
│       ├── src/
│       │   ├── index.ts
│       │   ├── lib/
│       │   │   └── auth.ts           # Better Auth config
│       │   └── routes/
│       │       ├── projects.ts
│       │       ├── providers.ts
│       │       └── apiKeys.ts
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared Package
│       ├── src/
│       │   ├── database/
│       │   │   ├── index.ts          # Sequelize connection
│       │   │   ├── migrate.ts
│       │   │   └── migrations/       # 19 migrations
│       │   │       ├── 000-add-users-table.ts
│       │   │       ├── 001-add-projects-and-environments.ts
│       │   │       ├── 002-add-agents-and-entity-link.ts
│       │   │       ├── ...
│       │   │       └── 018-add-context-window-to-llm-costs.ts
│       │   ├── models/               # Sequelize Models
│       │   │   ├── index.ts          # Model associations
│       │   │   ├── User.ts
│       │   │   ├── Project.ts
│       │   │   ├── Agent.ts
│       │   │   ├── Entity.ts
│       │   │   ├── Trace.ts
│       │   │   ├── LLMEvent.ts
│       │   │   ├── Provider.ts
│       │   │   ├── ApiKey.ts
│       │   │   ├── AgentAnalysisRun.ts
│       │   │   ├── AgentAnalysisFinding.ts
│       │   │   ├── EvalConfig.ts
│       │   │   └── EvalCase.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts           # Auth middleware
│       │   │   ├── auth-utils.ts
│       │   │   └── api-key-extractor.ts
│       │   ├── services/
│       │   │   └── index.ts          # Redis client, caching
│       │   ├── utils/
│       │   │   ├── crypto.ts         # AES encryption
│       │   │   ├── logger.ts         # Pino logger
│       │   │   └── helpers.ts
│       │   └── config/
│       │       ├── env.ts            # Environment config
│       │       └── service-urls.ts
│       └── package.json
│
├── scripts/
│   ├── deploy-gh.js
│   └── env-gh-secret-sync.js
│
├── tests/
│   ├── test-auto-threading.ts
│   └── test-complex-agent.ts
│
├── Dockerfile
├── package.json                      # Workspace root
├── tsconfig.json
└── .env.example
```

---

## 🔧 Backend Services

### 1. Proxy Service (`whyops-proxy`)

The proxy intercepts LLM API calls and logs events:

```typescript
// apps/whyops-proxy/src/index.ts

const app = new Hono();

// Authentication middleware for API keys
app.use('/v1/*', proxyAuthMiddleware);
app.use('/v1/*', rateLimitMiddleware);

// Routes
app.route('/v1', openaiRouter);      // OpenAI-compatible endpoints
app.route('/v1', anthropicRouter);   // Anthropic Messages API
app.route('/v1', agentsRouter);      // Agent-specific endpoints
```

#### Provider Resolution

```typescript
// apps/whyops-proxy/src/services/proxy-routing.ts

export async function resolveProviderFromModel(
  userId: string,
  model: string,           // "azure/gpt-4" or "openai/gpt-4o"
  defaultProvider: any
): Promise<ResolvedProvider> {
  // Parse "provider/model" format
  const { providerSlug, actualModel } = parseModelField(model);
  
  // Look up custom provider or use default
  const { provider, isCustom } = await getProviderBySlugOrDefault(
    userId, providerSlug, defaultProvider
  );
  
  return { provider, isCustom, providerSlug, actualModel };
}
```

#### Supported Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | OpenAI chat (with streaming) |
| `POST /v1/completions` | Legacy completions |
| `POST /v1/embeddings` | Embedding requests |
| `POST /v1/messages` | Anthropic Messages API |

### 2. Analyse Service (`whyops-analyse`)

Core event processing and LLM-powered analysis:

```typescript
// apps/whyops-analyse/src/index.ts

await initDatabase();
await startAnalyseEventsWorker();  // Redis Streams consumer

app.route('/api/events', eventsRouter);
app.route('/api/threads', threadsRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/agent-analyses', agentAnalysesRouter);
app.route('/api/evals', evalGenerationRouter);
```

#### Event Processing Pipeline

```typescript
// apps/whyops-analyse/src/services/events-queue.service.ts

export async function startAnalyseEventsWorker(): Promise<void> {
  const consumer = `${process.pid}-${randomId}`;
  
  // Create consumer group
  await ensureRedisConsumerGroup(
    env.EVENTS_STREAM_NAME,
    env.EVENTS_STREAM_GROUP
  );
  
  // Processing loop
  while (!stopWorkerRequested) {
    // Reclaim idle messages from crashed consumers
    if (loopCount % 10 === 0) {
      const reclaimed = await reclaimIdleRedisStreamMessages(...);
    }
    
    // Read batch from stream
    const messages = await readRedisStreamGroup(
      env.EVENTS_STREAM_NAME,
      env.EVENTS_STREAM_GROUP,
      consumer,
      env.EVENTS_STREAM_BATCH_SIZE,  // 100
      env.EVENTS_STREAM_BLOCK_MS     // 2000ms
    );
    
    // Process each message
    await Promise.all(messages.map(handleMessage));
  }
}
```

### 3. Auth Service (`whyops-auth`)

Authentication using Better Auth:

```typescript
// apps/whyops-auth/src/lib/auth.ts

export const auth = betterAuth({
  database: kyselyAdapter(db),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    github: {
      clientId: env.AUTHGH_CLIENT_ID,
      clientSecret: env.AUTHGH_CLIENT_SECRET,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
});
```

---

## 🖥 Frontend Application

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | App Router, Server Components |
| React | 19.2.3 | UI Framework |
| Tailwind CSS | 4.x | Styling |
| Zustand | 4.5.5 | State Management |
| ReactFlow | 11.11.4 | Trace Visualization |
| Recharts | 2.15.4 | Charts |
| shadcn/ui | 3.8.4 | UI Components |

### State Management

```typescript
// apps/app/src/stores/agentsStore.ts

interface AgentsState {
  agents: Agent[];
  currentAgent: Agent | null;
  isLoading: boolean;
  pagination: Pagination;
  
  fetchAgents: (page?: number, count?: number) => Promise<void>;
  fetchAgentById: (agentId: string) => Promise<Agent | null>;
  updateAgentSamplingRate: (agentId: string, rate: number) => Promise<number | null>;
  startPolling: (intervalMs: number) => void;
  stopPolling: () => void;
}

export const useAgentsStore = create<AgentsState>()(
  persist(
    (set, get) => ({
      // Implementation with localStorage persistence
    }),
    { name: 'whyops-agents-store', partialize: (s) => ({ apiKey: s.apiKey }) }
  )
);
```

### Key Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/agents` | `AgentsPage` | Agent list with stats |
| `/agents/[agentId]` | `AgentDetailsPage` | Single agent view |
| `/agents/[agentId]/traces/[traceId]` | `TraceDetailsPageContent` | Trace visualization |
| `/settings` | `SettingsPage` | Provider & API key config |
| `/traces` | `TracesPage` | All traces view |

### Trace Visualization

```typescript
// apps/app/src/components/traces/trace-canvas.tsx

// Uses ReactFlow for interactive trace visualization
// Custom nodes for each event type

const nodeTypes = {
  userMessage: UserMessageNode,
  llmResponse: LLMResponseNode,
  toolCall: ToolCallNode,
  toolResult: ToolResultNode,
  error: ErrorNode,
};
```

---

## 🗄 Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐       ┌──────────┐       ┌──────────────┐
  │  users   │──1:N──│ projects │──1:N──│ environments │
  └──────────┘       └──────────┘       └──────────────┘
       │                  │                    │
       │ 1:N              │ 1:N               │ 1:N
       ▼                  ▼                    ▼
  ┌──────────┐       ┌──────────┐       ┌──────────────┐
  │providers │       │  agents  │───────│   entities   │
  └──────────┘       └──────────┘       └──────────────┘
       │                  │                    │
       │ 1:N              │ 1:N               │ 1:N
       ▼                  │                    ▼
  ┌──────────┐            │              ┌──────────┐
  │ api_keys │◀───────────┴──────────────│  traces  │
  └──────────┘                           └──────────┘
                                              │
                                              │ 1:N
                                              ▼
                                        ┌──────────────┐
                                        │ trace_events │
                                        └──────────────┘
```

### Core Tables

#### `traces`

```typescript
// packages/shared/src/models/Trace.ts

interface TraceAttributes {
  id: string;              // traceId (from client)
  userId: string;
  providerId?: string;
  entityId?: string;       // Links to agent version
  sampledIn?: boolean;     // Sampling flag
  model?: string;
  systemMessage?: string;
  tools?: any[];           // Tool definitions
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `trace_events`

```typescript
// packages/shared/src/models/LLMEvent.ts

interface TraceEvent {
  id: string;
  traceId: string;
  entityId?: string;
  spanId?: string;
  stepId: number;
  parentStepId?: number;
  eventType: 
    | 'user_message'
    | 'llm_response'
    | 'embedding_request'
    | 'embedding_response'
    | 'llm_thinking'
    | 'tool_call'
    | 'tool_call_request'
    | 'tool_call_response'
    | 'tool_result'
    | 'error';
  userId: string;
  providerId?: string;
  timestamp: Date;
  content: any;            // JSONB - event-specific payload
  metadata?: Record<string, any>;
  createdAt: Date;
}
```

#### `agent_analysis_runs`

```typescript
// packages/shared/src/models/AgentAnalysisRun.ts

interface AgentAnalysisRunAttributes {
  id: string;
  userId: string;
  projectId: string;
  environmentId: string;
  agentId: string;
  configId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  windowStart: Date;
  windowEnd: Date;
  traceCount: number;
  eventCount: number;
  summary: Record<string, any>;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
}
```

### All Models (25 total)

```
packages/shared/src/models/
├── User.ts
├── Project.ts
├── Environment.ts
├── Provider.ts
├── ApiKey.ts
├── Agent.ts
├── Entity.ts
├── Trace.ts
├── LLMEvent.ts
├── RequestLog.ts
├── TraceAnalysis.ts
├── TraceAnalysisFinding.ts
├── AnalysisExperiment.ts
├── AgentAnalysisConfig.ts
├── AgentAnalysisRun.ts
├── AgentAnalysisSection.ts
├── AgentAnalysisFinding.ts
├── AgentKnowledgeProfile.ts
├── EvalConfig.ts
├── EvalRun.ts
├── EvalCase.ts
└── LlmCost.ts
```

---

## 📡 API Reference

### Authentication

All API requests require authentication via:

1. **API Key** (for programmatic access)
   ```bash
   curl -H "Authorization: Bearer whyops_xxx" https://api.whyops.com/v1/chat/completions
   ```

2. **Session Cookie** (for web UI)
   ```bash
   curl -b "better-auth.session_token=xxx" https://api.whyops.com/api/agents
   ```

### Events API

#### Ingest Events

```http
POST /api/events/ingest
Content-Type: application/json
Authorization: Bearer whyops_xxx

{
  "eventType": "user_message",
  "traceId": "trace_123",
  "agentName": "customer-support",
  "stepId": 1,
  "timestamp": "2024-01-15T10:30:00Z",
  "content": { "text": "What's my order status?" },
  "metadata": {}
}
```

#### Batch Ingest

```http
POST /api/events/ingest
Content-Type: application/json

[
  { "eventType": "user_message", "traceId": "t1", ... },
  { "eventType": "llm_response", "traceId": "t1", ... }
]
```

#### Event Types

| Type | Description | Required Metadata |
|------|-------------|-------------------|
| `user_message` | User input | - |
| `llm_response` | LLM output | `usage.totalTokens` |
| `llm_thinking` | Reasoning tokens | - |
| `tool_call` | Tool invocation | - |
| `tool_call_request` | Tool request | `tool` |
| `tool_call_response` | Tool response | `tool` |
| `tool_result` | Tool output | - |
| `embedding_request` | Embedding call | - |
| `embedding_response` | Embedding result | - |
| `error` | Error event | `error.message` |

### Traces API

```http
GET /api/threads?agentId=xxx&page=1&count=20
Authorization: Bearer whyops_xxx

Response:
{
  "threads": [
    {
      "id": "trace_123",
      "entityId": "agent_v1",
      "eventCount": 5,
      "firstEventAt": "2024-01-15T10:30:00Z",
      "lastEventAt": "2024-01-15T10:30:05Z",
      "hasError": false,
      "totalTokens": 450
    }
  ],
  "pagination": { "total": 100, "page": 1, "count": 20 }
}
```

### Agent Analysis API

#### Run Analysis

```http
POST /api/agent-analyses/run
Authorization: Bearer whyops_xxx

{
  "agentId": "agent_uuid",
  "lookbackDays": 14,
  "mode": "standard",
  "dimensions": ["intent_precision", "tool_routing_quality"]
}
```

#### Analysis Modes

| Mode | Events | Judge Summaries | Conversation Samples |
|------|--------|-----------------|---------------------|
| `quick` | 12,000 | 150 | 16 |
| `standard` | 60,000 | 400 | 36 |
| `deep` | 120,000 | 1,200 | 72 |

#### Analysis Dimensions

```typescript
const AGENT_DIMENSIONS = [
  'intent_precision',          // Intent identification quality
  'followup_repair',           // Follow-up handling
  'answer_completeness_clarity',
  'tool_routing_quality',      // When to use tools
  'tool_invocation_quality',   // How tools are called
  'tool_output_utilization',   // Tool result usage
  'reliability_recovery',      // Error handling
  'latency_cost_efficiency',
  'conversation_ux',
] as const;
```

### Analytics API

```http
GET /api/analytics/dashboard
Authorization: Bearer whyops_xxx

Response:
{
  "stats": {
    "totalAgents": 25,
    "activeTraces": 1543,
    "successRate": 94.5,
    "successRateDelta": 2.3,
    "avgLatencyMs": 1250,
    "avgLatencyDeltaMs": -150
  },
  "chartData": [...],
  "agentUsage": [...]
}
```

---

## 🔄 Event System

### Event Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EVENT LIFECYCLE                                   │
└─────────────────────────────────────────────────────────────────────┘

  1. PROXY INGESTION
     ┌─────────────┐
     │ LLM Request │
     │  (stream)   │
     └──────┬──────┘
            │
            ▼
  2. EVENT CAPTURE
     ┌─────────────────────────────────────────┐
     │ Proxy parses response chunks            │
     │ • Extract usage, latency, model         │
     │ • Handle streaming accumulation         │
     │ • Create trace if new traceId           │
     └──────────────────┬──────────────────────┘
                        │
                        ▼
  3. REDIS STREAM QUEUE
     ┌─────────────────────────────────────────┐
     │ XADD whyops:events * payload {...}      │
     │ Max length: 200,000 messages            │
     │ Consumer group: whyops-analyse-workers  │
     └──────────────────┬──────────────────────┘
                        │
                        ▼
  4. WORKER PROCESSING
     ┌─────────────────────────────────────────┐
     │ XREADGROUP → process → XACK             │
     │ Batch size: 100                         │
     │ Block: 2000ms                           │
     │ Retry: 5 max → DLQ                      │
     └──────────────────┬──────────────────────┘
                        │
                        ▼
  5. DATABASE PERSISTENCE
     ┌─────────────────────────────────────────┐
     │ • Insert trace_events                   │
     │ • Update traces (aggregates)            │
     │ • Update entities (stats)               │
     │ • Link to agent/version                 │
     └─────────────────────────────────────────┘
```

### Event Schema

```typescript
// apps/whyops-analyse/src/routes/events.ts

const eventSchema = z.object({
  eventType: z.enum([
    'user_message',
    'llm_response',
    'embedding_request',
    'embedding_response',
    'llm_thinking',
    'tool_call',
    'tool_call_request',
    'tool_call_response',
    'tool_result',
    'error',
  ]),
  traceId: z.string().min(1).max(128),
  spanId: z.string().max(128).optional(),
  stepId: z.number().int().min(1).optional(),
  parentStepId: z.number().int().min(1).optional(),
  agentName: z.string().min(1).max(255),
  timestamp: z.string().datetime().optional(),
  content: z.any().optional(),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string().max(128).optional(),
});
```

---

## 🤖 LLM Judge System

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LLM JUDGE PIPELINE                                │
└─────────────────────────────────────────────────────────────────────┘

                        ┌──────────────────┐
                        │ AgentAnalysisRun │
                        │     Request      │
                        └────────┬─────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────┐
              │     1. DATA COLLECTION           │
              │  • Query traces in window        │
              │  • Load user messages            │
              │  • Calculate trace stats         │
              │  • Sample conversation traces    │
              └────────────────┬─────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────┐
              │     2. INTELLIGENCE GATHERING    │
              │  • Query Intelligence (top Qs)   │
              │  • Followup Intelligence         │
              │  • Intent Intelligence           │
              │  • Tool Intelligence             │
              │  • Quality Intelligence          │
              └────────────────┬─────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────┐
              │     3. INTENT ROUTING            │
              │  Classify first user messages:   │
              │  • real_time_lookup              │
              │  • troubleshooting_support       │
              │  • how_to_guidance               │
              │  • planning_recommendation       │
              │  • content_generation            │
              │  • data_analysis_reporting       │
              └────────────────┬─────────────────┘
                               │
                               ▼
       ┌───────────────────────┴───────────────────────┐
       │                                               │
       ▼                                               ▼
┌──────────────────┐                         ┌──────────────────┐
│   DIMENSION      │                         │   DIMENSION      │
│   ANALYSIS       │  ... (parallel)         │   ANALYSIS       │
│   (intent_       │                         │   (tool_routing) │
│    precision)    │                         │                  │
└────────┬─────────┘                         └────────┬─────────┘
         │                                            │
         └───────────────────┬────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────────┐
              │     4. SYNTHESIS                 │
              │  • Combine dimension results     │
              │  • Generate overall score        │
              │  • Prioritize recommendations    │
              └────────────────┬─────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────┐
              │     5. PERSISTENCE               │
              │  • Save sections (JSONB)         │
              │  • Create findings records       │
              │  • Update agent profile          │
              └──────────────────────────────────┘
```

### LangChain Chains

```typescript
// apps/whyops-analyse/src/langchain/chains/index.ts

// Dimension analysis chains
export { runAgentDimensionAnalysisChain } from './agent-dimension-analysis.chain';
export { runAgentSynthesisChain } from './agent-synthesis.chain';
export { runAgentOverviewAnalysisChain } from './agent-overview-analysis.chain';
export { runAgentTraceIntentRoutingChain } from './agent-trace-intent-routing.chain';

// Per-trace judge chains
export { runStepCorrectnessChain } from './step-correctness.chain';
export { runToolChoiceChain } from './tool-choice.chain';
export { runPromptQualityChain } from './prompt-quality.chain';
export { runToolDescriptionChain } from './tool-description.chain';
export { runCostEfficiencyChain } from './cost-efficiency.chain';

// Eval generation chains
export { runEvalGenerationChain } from './eval-generation.chain';
export { runEvalValidationChain } from './eval-validation.chain';
export { runEvalCritiqueChain } from './eval-critique.chain';
```

### Judge Model Configuration

```typescript
// apps/whyops-analyse/src/langchain/config.ts

export function getJudgeModel(overrideModel?: string): BaseChatModel {
  return new ChatOpenAI({
    model: overrideModel || env.JUDGE_LLM_MODEL,  // e.g., "azure/gpt-4.1"
    apiKey: env.JUDGE_LLM_API_KEY,
    temperature: env.JUDGE_LLM_TEMPERATURE || 0,
    maxRetries: 1,
    timeout: 60000,
    configuration: {
      baseURL: env.JUDGE_LLM_BASE_URL,  // LiteLLM proxy
    },
  });
}

export const THRESHOLDS = {
  PROMPT_SEGMENT_TOKEN_LIMIT: 4000,
  TOOL_FULL_SEND_LIMIT: 15,
  TOOL_CANDIDATE_CAP: 20,
  TRACE_MAP_REDUCE_LIMIT: 30,
  PATCH_CONFIDENCE_THRESHOLD: 0.7,
};
```

### Dimension Analysis Result

```typescript
interface AgentDimensionAnalysisResult {
  dimension: AgentJudgeDimension;
  score: number;              // 0-1
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;         // 0-1
  summary: string;
  strengths: string[];
  weaknesses: string[];
  issues: Array<{
    code: string;
    title: string;
    detail: string;
    severity: AgentJudgeSeverity;
    confidence: number;
    frequency: number;
    impactScore: number;
    evidence: Array<{
      traceId: string | null;
      signalType: string;
      snippet: string;
    }>;
    rootCause: string;
    recommendation: {
      action: string;
      detail: string;
      ownerType: string;
      fixType: string;
    };
    patches: Record<string, any>[];
  }>;
}
```

---

## ⚙️ Configuration

### Environment Variables

<details>
<summary><strong>Complete Environment Reference</strong></summary>

```bash
# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:pass@host:5432/whyops

# Individual settings (alternative to DATABASE_URL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whyops
DB_USER=postgres
DB_PASSWORD=postgres
DB_POOL_MAX=20
DB_POOL_MIN=5

# ============================================
# APPLICATION
# ============================================
NODE_ENV=development          # development | production
LOG_LEVEL=info               # trace | debug | info | warn | error

# ============================================
# SERVICE PORTS
# ============================================
PROXY_PORT=8080
ANALYSE_PORT=8081
AUTH_PORT=8082

# ============================================
# SERVICE URLs
# ============================================
PROXY_URL=http://localhost:8080
ANALYSE_URL=http://localhost:8081
AUTH_URL=http://localhost:8082

# ============================================
# SECURITY
# ============================================
JWT_SECRET=your-jwt-secret-min-32-chars
API_KEY_PREFIX=whyops

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================
# PROXY
# ============================================
PROXY_TIMEOUT_MS=60000
PROXY_MAX_RETRIES=3

# ============================================
# REDIS
# ============================================
REDIS_URL=rediss://host:6379
REDIS_KEY_PREFIX=whyops

# ============================================
# EVENT QUEUE
# ============================================
EVENTS_STREAM_NAME=whyops:events
EVENTS_DLQ_STREAM_NAME=whyops:events:dlq
EVENTS_STREAM_GROUP=whyops-analyse-workers
EVENTS_STREAM_MAX_LEN=200000
EVENTS_STREAM_BATCH_SIZE=100
EVENTS_STREAM_BLOCK_MS=2000
EVENTS_STREAM_RETRY_MAX=5
EVENTS_WORKER_ENABLED=true

# ============================================
# CACHING
# ============================================
AUTH_APIKEY_CACHE_TTL_SEC=60
PROVIDER_CACHE_TTL_SEC=60
APIKEY_LAST_USED_WRITE_INTERVAL_SEC=300

# ============================================
# V1 LIMITS
# ============================================
MAX_AGENTS_PER_PROJECT=20
MAX_TRACES_PER_AGENT=10000
MAX_TRACES_PER_ENTITY=5000
DEFAULT_TRACE_SAMPLING_RATE=0.2

# ============================================
# AUTHENTICATION
# ============================================
BETTER_AUTH_URL=http://localhost:8082
BETTER_AUTH_SECRET=min-32-char-secret

# Trusted origins (CORS)
TRUSTED_ORIGINS=http://localhost:3000,http://localhost:5173

# OAuth - GitHub
AUTHGH_CLIENT_ID=
AUTHGH_CLIENT_SECRET=

# OAuth - Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (Maileroo)
MAILEROO_API_KEY=
MAILEROO_FROM_EMAIL=noreply@whyops.com
MAILEROO_FROM_NAME=WhyOps

# ============================================
# LLM JUDGE (LiteLLM Proxy)
# ============================================
JUDGE_LLM_BASE_URL=https://litellm.example.com/v1
JUDGE_LLM_API_KEY=sk-your-key
JUDGE_LLM_MODEL=azure/gpt-4.1
JUDGE_LLM_TEMPERATURE=0
JUDGE_MAX_RETRIES=2
```

</details>

---

## 🐳 Deployment

### Docker Build

```bash
# Build proxy service
docker build --build-arg SERVICE=proxy -t whyops-proxy .

# Build analyse service
docker build --build-arg SERVICE=analyse -t whyops-analyse .

# Build auth service
docker build --build-arg SERVICE=auth -t whyops-auth .
```

### Dockerfile (Unified)

```dockerfile
# Single Dockerfile for all services
ARG SERVICE
FROM node:22-alpine AS builder
ARG SERVICE
# ... build steps

FROM node:22-alpine AS production
ARG SERVICE
ENV NODE_ENV=production \
    SERVICE=${SERVICE} \
    PROXY_PORT=8080 \
    ANALYSE_PORT=8081 \
    AUTH_PORT=8082
# ... runtime config
CMD ["node", "--import", "tsx", "src/index.ts"]
```

### Health Checks

```bash
# Proxy
curl http://localhost:8080/health

# Analyse
curl http://localhost:8081/api/health

# Auth
curl http://localhost:8082/health
```

### Graceful Shutdown

```typescript
// All services implement graceful shutdown

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, 'Shutting down service');

  // Force exit after 10s
  setTimeout(() => process.exit(1), 10000).unref();

  // Close HTTP server
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });

  // Stop workers (for analyse service)
  await stopAnalyseEventsWorker();

  // Close Redis
  await closeRedisClient();

  // Close database
  await closeDatabase();

  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => void shutdown(signal));
}
```

---

## 🛠 Development

### Available Scripts

```bash
# Development
npm run dev              # Start all services
npm run dev:proxy        # Start proxy only
npm run dev:analyse      # Start analyse only
npm run dev:auth         # Start auth only
npm run dev:app          # Start frontend only

# Build
npm run build            # Build all services
npm run build:shared     # Build shared package
npm run build:proxy      # Build proxy
npm run build:analyse    # Build analyse
npm run build:auth       # Build auth
npm run build:app        # Build frontend

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database

# Tests
npm run test:auto-threading
npm run test:complex-agent
```

### Code Quality

- **Max file size**: 200 lines per file
- **Module pattern**: ESM (`import`/`export`)
- **Validation**: Zod schemas for all inputs
- **Logging**: Pino with structured output
- **Error handling**: Custom error boundaries per pipeline stage

### Database Migrations

```bash
# Create new migration
# File: packages/shared/src/database/migrations/019-add-new-table.ts

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('new_table', {
    id: { type: DataTypes.UUID, primaryKey: true },
    // ...
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('new_table');
}
```

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Backend TypeScript Lines | ~18,000 |
| Frontend Components | 102 |
| Frontend Store Lines | ~3,700 |
| Database Migrations | 19 |
| API Routes | ~25 |
| LLM Judge Chains | 12 |
| Analysis Dimensions | 9 |

---

## 📝 License

WhyOps is available under **Apache License 2.0 with Commons Clause**.

You can fork, study, modify, and redistribute this repository, but you may not sell WhyOps itself or a lightly rebranded copy of it without separate written permission from the licensor.

This is a **source-available** license, not an OSI open-source license. See [LICENSE](LICENSE) for the full legal text.

---

<div align="center">

**Built with ❤️ for AI agent developers**

</div>
