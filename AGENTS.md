## Code Quality Guardrails
- Keep modules small and focused: **max 200 lines per file**.
- Prefer composition over inheritance and avoid God objects/services.
- Use Node.js ESM (`import`/`export`) consistently.
- Validate all external inputs with `zod` before business logic.
- Keep HTTP controllers thin; put business logic in services.
- Keep database logic in repositories and models only.
- Use structured logs (`pino`) with stable keys and no secrets.
- Make all long-running automation idempotent and resumable.
- Add retry/backoff only around transient network operations.
- Never hardcode credentials or endpoints; use environment config.

## Scalability Principles
- Separate API, scheduler, and worker responsibilities.
- Support horizontal scaling by avoiding in-memory state coupling.
- Deduplicate leads with DB constraints and upsert flows.
- Use explicit statuses for run tracking and outreach lifecycle.
- Make provider integrations pluggable (search, LLM, enrichment, mail).

## Reliability Requirements
- Use robust error boundaries around each pipeline stage.
- Persist run metadata (`startedAt`, `finishedAt`, `status`, stats).
- Avoid partial writes: wrap dependent DB updates in transactions where needed.
- Record failures with actionable error context for reprocessing.

## Security & Compliance
- Respect platform ToS and rate limits for social research providers.
- Send outreach only to opted or compliant sources per jurisdiction.
- Redact PII from logs and avoid storing unnecessary personal data.

## Developer Workflow
- Run lint/checks before merging.
- Prefer additive migrations and backwards-compatible schema changes.
- Keep README and `.env.example` in sync with runtime requirements.