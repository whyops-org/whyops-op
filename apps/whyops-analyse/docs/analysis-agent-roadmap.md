# WhyOps Analysis Agent Roadmap (RALPH Loop)

## Goal
Build an analysis agent that can inspect traces + entity metadata, generate improvements, test hypotheses, and recommend/promote better configurations with measurable quality/cost/latency gains.

RALPH loop:
1. **R**ecord
2. **A**nalyze
3. **L**earn
4. **P**atch
5. **H**ypothesis-test

---

## Scope
- Inputs:
  - Trace events (`trace_events`)
  - Trace-level metadata (`traces`)
  - Agent/entity metadata (system prompt, tool definitions, schemas)
- Outputs:
  - Structured findings
  - Candidate prompt/tool/schema patches
  - Experimental results (replay/live)
  - Ranked recommendations

Out of scope (initially):
- Fully autonomous production auto-promotion without human approval
- Provider-specific deep optimizations beyond generic quality/cost/latency controls

---

## Architecture Options
1. **Trace-only Judge**
   - Pros: cheap, fast
   - Cons: low confidence for “will this change actually work?”
2. **Replay Judge (deterministic)**
   - Uses recorded tool outputs; no external tool calls
   - Best baseline for safe evaluation
3. **Live Hypothesis Judge**
   - Runs variants through user’s real agent API
   - Highest confidence, highest cost/risk
4. **Recommended: Progressive Hybrid**
   - Trace-only -> Replay -> Live finalist validation

---

## Data Model (already added)
- `trace_analyses`
  - status, rubric version, judge model, mode, summary
- `trace_analysis_findings`
  - per-step/per-dimension findings, severity, confidence, evidence, recommendation
- `analysis_experiments`
  - hypothesis variants and run stats

Also:
- `traces.sampled_in` for trace-level all-or-nothing sampling.

---

## Recommended Staged Build

## Stage 1: Static Analyzer (No LLM First)
Objective:
- Deterministically analyze trace quality and persist objective findings.

Checks:
- Trace integrity
- Step ordering anomalies
- Missing tool results / tool request-response mismatches
- Schema mismatches
- Retry/loop patterns

Outputs:
- Deterministic findings stored in `trace_analysis_findings`.

Current implementation status:
- Implemented (initial version) via `POST /api/analyses` in analyse service.

## Stage 2: LLM Judge v1
Objective:
- Add semantic judgment on top of deterministic findings.

Dimensions:
- Step correctness
- Tool choice quality
- Prompt quality
- Tool-description quality
- Cost/latency efficiency

Hard requirement:
- Strict JSON output only (no free text blobs).

## Stage 3: Counterfactual Generator
Objective:
- Generate candidate improvements from Stage 1 + Stage 2 findings.

Candidate patch types:
- System prompt patch
- Tool description patch
- Tool schema patch
- Parameter patch (temperature/tool choice/etc.)

## Stage 4: Hypothesis Runner
Objective:
- Validate candidate patches experimentally.

Execution order:
- Replay mode first (recorded tool outputs)
- Optional live mode via user agent API

Persistence:
- Store every variant run and metrics in `analysis_experiments`.

## Stage 5: Optimizer Loop (RALPH)
Objective:
- Rank variants and decide promotion readiness.

Ranking factors:
- Quality delta
- Risk score

Promotion rule:
- Promote only when confidence threshold + gain threshold are met.

---

## Handling Very Large System Prompts
1. Segment prompt into named blocks:
   - role
   - policy
   - tooling
   - style
   - fallback
2. Judge per block first, then run full-context pass only for high-impact blocks.
3. Use map-reduce judging for long traces:
   - per-step local judgments
   - global synthesis pass
4. Store prompt as:
   - canonical full text
   - segmented block map
   - structural digest/hash
5. Patch with diffs, not full rewrites, for auditability and regression control.

---

## How to Evaluate “Better”
- Cost per successful outcome
- Latency per successful outcome
- Error/loop rate
- Robustness across a trace set (not a single trace)

---

## Key Guardrails
1. Never auto-promote on a single trace.
2. Require minimum sample size per candidate.
3. Keep hard constraints (safety/legal/tool bans) non-negotiable.
4. Version everything:
   - rubric version
   - judge model
   - patch version
   - experiment config

---

## Near-Term Execution
1. Finish and stabilize Stage 1 static analyzer checks + report schema.
2. Add Stage 2 judge contract and strict JSON schema.
3. Add Stage 3 patch generation interface.
4. Add Stage 4 replay runner and scoring harness.
5. Add Stage 5 ranking/promotion policy engine.
