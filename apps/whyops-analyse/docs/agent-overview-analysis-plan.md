# Agent Overview Analysis — Plan of Action

## Objective
Build a scheduled, agent-level analysis artifact that summarizes behavior across many traces and answers:
- What users ask most
- What follow-ups indicate (clarification, missing info, correction, retry, new intent)
- What top intents are
- How tools are used and which tools perform best/worst
- Where quality, latency, and cost are degrading
- What concrete actions should be taken

This complements existing per-trace analysis (`static-v1`, `judge-v1`) and existing timing/thread views.

---

## Current Baseline
- Per-trace timing and detail views exist.
- Per-trace deterministic analysis exists (`static-v1`).
- Per-trace LLM judge exists (`judge-v1`).
- Agent endpoints currently expose basic metrics, not persisted deep analysis runs.
- Event payloads are heterogeneous, so normalization is required before reliable aggregation.

---

## Scope

### In Scope
- Agent-level scheduled analysis runs (cron-based)
- Manual run trigger
- Persisted run artifacts for UI/API retrieval
- Deterministic metrics + LLM enrichment
- Large-scale processing strategy for high trace volume

### Out of Scope (initial)
- Fully autonomous remediation
- Automatic config changes in production
- Cross-agent benchmarking across different users

---

## Output Model (What User Sees)

### 1. Overview
- Total traces/events in window
- Multi-turn rate
- Error rate
- Latency p50/p90
- Token usage and trend
- Tool-call rate and follow-up rate

### 2. Query Intelligence
- Top initial user queries (normalized)
- Top repeated queries
- Top high-error/high-latency query classes

### 3. Follow-Up Intelligence
- Top follow-up queries
- Follow-up reasons distribution:
  - `clarification_needed`
  - `missing_info`
  - `correction`
  - `retry_rephrase`
  - `new_intent`

### 4. Intent Intelligence
- Top intent clusters
- Intent share by percent
- Shift vs previous run

### 5. Tool Intelligence
- Tool usage counts
- Tool likely success/failure
- Tool retry rate
- Best/worst performing tools

### 6. Quality Intelligence
- Aggregated quality signals (sampled trace judge summaries)
- Common failure themes

### 7. Recommendations
- Prioritized action list with expected impact

### 8. Outcome Intelligence
- Resolution rate (`resolved`, `partially_resolved`, `unresolved`)
- Time to resolution (turns + elapsed time)
- Drop-off and reopen rate
- Containment vs escalation-needed rate

### 9. Answer Quality Intelligence
- Completeness, directness, actionability, consistency
- Uncertainty calibration quality
- Verbosity-fit quality (too short/too long for query type)

### 10. Follow-Up Root-Cause Intelligence
- Root cause buckets for follow-ups:
  - unclear answer
  - missing detail
  - wrong answer
  - no answer
  - changed user goal
- Recovery-after-follow-up rate
- Looping follow-up chain detection

### 11. Intent Journey Intelligence
- Intent transition graph (`intent A -> intent B`)
- Intent completion funnel
- Emerging/new intent detection
- Intent drift over time

### 12. Tool Orchestration Intelligence
- Tool precision by intent
- Tool miss rate (tool should have been used but was not)
- Tool argument quality
- Tool chain quality (useful sequence vs wasteful chain)

### 13. Knowledge Gap Intelligence
- Retrieval miss suspicion clusters
- Knowledge coverage gaps (high-demand topics with low quality)
- Potential stale-content clusters

### 14. Risk and Trust Intelligence
- Hallucination risk indicators
- Refusal quality (under-refuse/over-refuse)
- Sensitive-topic handling quality
- PII and compliance risk indicators

### 15. Regression Intelligence
- Version-over-version win/loss matrix
- Change-point detection for sudden degradation
- Dimension-level regression alerts

---

## Data Model Additions

### `agent_analysis_configs`
- `id` (uuid)
- `user_id`, `project_id`, `environment_id`, `agent_id`
- `enabled` (bool)
- `cron_expr` (string)
- `timezone` (string)
- `lookback_days` (int)
- `sampling_config` (jsonb)
- `last_run_at`, `next_run_at`
- `created_at`, `updated_at`

### `agent_analysis_runs`
- `id` (uuid)
- `config_id` (nullable for manual runs)
- `user_id`, `project_id`, `environment_id`, `agent_id`
- `status` (`pending|running|completed|failed`)
- `window_start`, `window_end`
- `trace_count`, `event_count`
- `summary` (jsonb)
- `error` (text nullable)
- `started_at`, `finished_at`, `created_at`, `updated_at`

### `agent_analysis_sections`
- `id` (uuid)
- `run_id`
- `section_key` (string)
- `payload` (jsonb)
- `created_at`

Recommended indexes:
- `(agent_id, created_at desc)` on runs
- `(run_id, section_key)` unique on sections
- `(enabled, next_run_at)` on configs

---

## API Plan
- `POST /api/agent-analyses/:agentId/run` (manual)
- `GET /api/agent-analyses/:agentId/latest`
- `GET /api/agent-analyses/runs/:runId`
- `GET /api/agent-analyses/:agentId/runs?count=&page=`
- `POST /api/agent-analyses/configs`
- `PATCH /api/agent-analyses/configs/:id`
- `GET /api/agent-analyses/configs/:agentId`

---

## Execution Architecture

### Scheduler
- Every minute: fetch due configs (`enabled=true AND next_run_at <= now`)
- Claim lock per config (`redis SET NX EX` or PG advisory lock)
- Enqueue run job
- Advance `next_run_at`

### Worker
- Resolve analysis window
- Execute deterministic aggregation first
- Execute LLM enrichment on sampled subsets
- Persist run + sections
- Mark status completed/failed

### Idempotency
- Idempotency key: `agent_id + window_start + window_end + config_id`
- Prevent duplicate runs across multi-instance deployments

---

## Handling Large Amounts of Traces (Core Strategy)

Large-scale processing uses a tiered strategy:

### A. Windowing and Incremental Processing
- Analyze by bounded windows (e.g. last 7/14/30 days), not all-time.
- For frequent cron schedules, support incremental mode:
  - Process only traces/events after last successful run.
  - Merge into rolling aggregates.

### B. Deterministic First, LLM Second
- Run all heavy counting/grouping in SQL first.
- Send only compact summaries and representative samples to LLM.
- Avoid passing raw full event streams unless needed.

### C. Sampling Strategy
- Trace sampling for LLM enrichment:
  - Random baseline sample
  - Stratified samples for:
    - error traces
    - high-latency traces
    - high tool-call traces
    - high follow-up traces
- Keep deterministic metrics unsampled whenever affordable.

### D. Query and Payload Reduction
- Use projection queries (only required columns).
- Normalize `user_message` and tool payload into canonical text/features.
- Use top-K extraction in SQL before LLM (queries, tools, errors).

### E. Map-Reduce Pattern for LLM Tasks
- Chunk sampled traces or query sets.
- Per-chunk classify/cluster.
- Reduce into global intents/themes/recommendations.
- Limit chunk sizes and use bounded concurrency.

### F. Concurrency and Backpressure
- Limit concurrent agent-analysis jobs globally.
- Limit per-job LLM concurrency.
- Queue jobs with retries and DLQ behavior.
- Fail fast on extreme budget limits and keep partial deterministic output.

### G. Caching and Reuse
- Cache normalized query fingerprints and intent labels by hash.
- Cache tool performance snapshots per window.
- Reuse previous run embeddings/clusters when overlap is high.

### H. Pre-Aggregation (Phase 2)
- Add daily rollup tables/materialized views for:
  - events by type
  - tool usage and likely error rates
  - latency/token distributions
- Agent run consumes rollups + recent raw deltas.

### I. Data Quality Guardrails
- If input quality degrades, return diagnostics instead of silent wrong insights:
  - low query parseability
  - missing tool correlation ids
  - malformed user payload ratios
- Track a per-run data-quality score.

### J. Cost Controls
- Per-run token budget caps
- Dynamic sample-size scaling based on trace volume
- Mode selection:
  - `quick` for high-frequency cron
  - `standard` default
  - `deep` on-demand/manual

### K. Volume Tiers
- `<= 10k traces/window`: full deterministic + moderate LLM sampling
- `10k - 100k traces/window`: deterministic full + aggressive stratified sampling
- `> 100k traces/window`: rollups + incremental deltas + narrow LLM cohorts

---

## Known Data Gaps to Fix
1. Ensure stable request/response tool correlation key (`call_id` or stable `span_id` semantics).
2. Emit tool latency on `tool_call_response`.
3. Normalize/stamp user query text at ingestion time for robust top-query analytics.
4. Optionally persist `entity_id` on `trace_events` for faster joins.

---

## Phased Delivery

### Phase 1 (MVP)
- New tables + run pipeline
- Deterministic overview/query/tool sections
- Manual run + latest run API

### Phase 2
- LLM intent + follow-up reason classification
- Scheduled cron configs
- Recommendations section

### Phase 3
- Incremental processing + rollups
- Better caching + cost optimization
- Trend comparison across runs

---

## Success Criteria
- Run finishes within target SLA for expected trace volume window.
- Output is stable/reproducible for deterministic sections.
- LLM sections stay within budget with useful confidence.
- Users can act on recommendations without reading raw traces.
