import { createServiceLogger } from '@whyops/shared/logger';
import { runEvalGenerationChain } from '../../langchain/chains/eval-generation.chain';
import { runEvalValidationChain } from '../../langchain/chains/eval-validation.chain';
import { runEvalCritiqueChain } from '../../langchain/chains/eval-critique.chain';
import type { GeneratedEvalCase } from '../../langchain/schemas/eval-generation.schema';
import type { AgentProfile } from './agent-profile-extractor';
import type { KnowledgeProfile } from './knowledge-builder';

const logger = createServiceLogger('analyse:eval:generator');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type EvalCategory =
  | 'happy_path'
  | 'edge_case'
  | 'multi_step'
  | 'safety'
  | 'error_handling'
  | 'adversarial'
  | 'feature_specific';

export const ALL_CATEGORIES: EvalCategory[] = [
  'happy_path',
  'edge_case',
  'multi_step',
  'safety',
  'error_handling',
  'adversarial',
];

interface GenerateEvalsInput {
  agentProfile: AgentProfile;
  knowledgeProfile: KnowledgeProfile;
  categories: EvalCategory[];
  maxEvalsPerRun: number;
  customPrompt?: string;
  judgeModel?: string;
  critiqueRounds?: number;
  onStageUpdate?: (stage: string, detail: string) => void;
}

interface GenerateEvalsResult {
  evals: GeneratedEvalCase[];
  categoryCounts: Record<string, number>;
  totalGenerated: number;
  pipelineStats: {
    candidatesGenerated: number;
    afterValidation: number;
    afterDedup: number;
    critiqueRoundsRun: number;
    finalCount: number;
  };
}

// ---------------------------------------------------------------------------
// Budget allocation
// ---------------------------------------------------------------------------
function allocateEvalBudget(
  categories: EvalCategory[],
  totalBudget: number,
  hasCustomPrompt: boolean
): Record<string, number> {
  const weights: Record<string, number> = {
    happy_path: 3, edge_case: 3, multi_step: 2,
    safety: 2, error_handling: 2, adversarial: 1, feature_specific: 3,
  };

  const active = hasCustomPrompt
    ? [...new Set([...categories, 'feature_specific' as EvalCategory])]
    : categories;

  const totalWeight = active.reduce((s, c) => s + (weights[c] || 1), 0);
  const budget: Record<string, number> = {};

  for (const cat of active) {
    budget[cat] = Math.max(2, Math.round((totalBudget * (weights[cat] || 1)) / totalWeight));
  }

  return budget;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
function formatToolsSummary(tools: AgentProfile['tools']): string {
  if (tools.length === 0) return '(No tools defined)';
  return tools
    .map((t) => {
      const params = t.parameters?.properties
        ? Object.entries(t.parameters.properties)
            .map(([k, v]: [string, any]) => `${k}: ${v.type || 'any'}${v.description ? ' — ' + v.description : ''}`)
            .join(', ')
        : 'none';
      return `- ${t.name}: ${t.description || '(no description)'} [params: ${params}]`;
    })
    .join('\n');
}

function formatKnowledge(k: KnowledgeProfile, field: keyof KnowledgeProfile): string {
  const val = k[field];
  if (!val || (Array.isArray(val) && val.length === 0)) return '(None identified)';
  if (Array.isArray(val)) {
    return val
      .map((item: any) =>
        typeof item === 'string' ? `- ${item}` : `- [${item.severity || item.priority || ''}] ${item.code || item.area || item.expectation || ''}: ${item.description || item.practice || item.expectation || ''}`
      )
      .join('\n');
  }
  return String(val);
}

function formatEvalForValidation(evals: GeneratedEvalCase[]): string {
  return evals
    .map((e, i) => {
      const firstUserMsg = e.conversation.find((t) => t.role === 'user')?.content || '';
      return `[${i}] "${e.title}" (${e.category}/${e.subcategory || 'general'}, ${e.difficulty})\n    User: "${firstUserMsg.slice(0, 150)}"\n    Tools: ${e.tools_tested.join(', ') || 'none'}\n    Expected: ${JSON.stringify(e.expected_outcome).slice(0, 200)}`;
    })
    .join('\n\n');
}

function computeToolCoverage(evals: GeneratedEvalCase[], tools: AgentProfile['tools']): string {
  const allToolNames = new Set(tools.map((t) => t.name));
  const tested = new Set<string>();
  for (const e of evals) for (const t of e.tools_tested) tested.add(t);

  const lines: string[] = [];
  for (const name of allToolNames) {
    const count = evals.filter((e) => e.tools_tested.includes(name)).length;
    lines.push(`- ${name}: ${count} evals ${count === 0 ? '⚠ UNCOVERED' : ''}`);
  }
  const uncovered = [...allToolNames].filter((t) => !tested.has(t));
  if (uncovered.length > 0) lines.push(`\nUNCOVERED TOOLS: ${uncovered.join(', ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Stage 1: OVER-GENERATE (2x budget)
// ---------------------------------------------------------------------------
async function stageGenerate(
  agentProfile: AgentProfile,
  knowledgeProfile: KnowledgeProfile,
  budget: Record<string, number>,
  customPrompt: string | undefined,
  judgeModel: string | undefined,
  onStageUpdate?: (stage: string, detail: string) => void
): Promise<GeneratedEvalCase[]> {
  onStageUpdate?.('generate', 'Over-generating eval candidates (2x budget)');

  const toolsSummary = formatToolsSummary(agentProfile.tools);
  const constraints = agentProfile.constraints.length > 0
    ? agentProfile.constraints.map((c) => `- ${c}`).join('\n')
    : '(No constraints)';

  const results = await Promise.allSettled(
    Object.entries(budget).map(async ([category, count]) => {
      // Over-generate: 2x the budget
      const overCount = Math.min(count * 2, 30);
      logger.info({ category, requested: overCount }, 'Generating candidates');

      return runEvalGenerationChain(
        {
          agentName: agentProfile.name,
          persona: agentProfile.persona,
          systemPrompt: agentProfile.systemPrompt.fullText,
          toolsSummary,
          toolCount: agentProfile.tools.length,
          constraints,
          category,
          evalCount: overCount,
          domain: knowledgeProfile.domain,
          failureModes: formatKnowledge(knowledgeProfile, 'failureModes'),
          edgeCasePatterns: formatKnowledge(knowledgeProfile, 'edgeCasePatterns'),
          userExpectations: formatKnowledge(knowledgeProfile, 'userExpectations'),
          safetyConsiderations: formatKnowledge(knowledgeProfile, 'safetyConsiderations'),
          customPrompt: category === 'feature_specific' ? customPrompt : undefined,
        },
        judgeModel
      );
    })
  );

  const all: GeneratedEvalCase[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
    else logger.error({ error: r.reason }, 'Category generation failed');
  }

  onStageUpdate?.('generate', `Generated ${all.length} candidates`);
  return all;
}

// ---------------------------------------------------------------------------
// Stage 2: VALIDATE (LLM-as-judge scores each candidate)
// ---------------------------------------------------------------------------
async function stageValidate(
  candidates: GeneratedEvalCase[],
  agentProfile: AgentProfile,
  judgeModel: string | undefined,
  onStageUpdate?: (stage: string, detail: string) => void
): Promise<GeneratedEvalCase[]> {
  onStageUpdate?.('validate', `Validating ${candidates.length} candidates`);

  const toolNames = agentProfile.tools.map((t) => t.name).join(', ');

  // Validate in batches of 15 to stay within context limits
  const BATCH_SIZE = 15;
  const kept: GeneratedEvalCase[] = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    try {
      const scores = await runEvalValidationChain(
        {
          agentName: agentProfile.name,
          toolNames,
          evalCandidates: formatEvalForValidation(batch),
        },
        judgeModel
      );

      for (const score of scores) {
        if (score.evalIndex >= 0 && score.evalIndex < batch.length && score.verdict !== 'discard') {
          kept.push(batch[score.evalIndex]);
        }
      }
    } catch (error) {
      logger.warn({ error, batchStart: i }, 'Validation batch failed, keeping all in batch');
      kept.push(...batch);
    }
  }

  onStageUpdate?.('validate', `${kept.length}/${candidates.length} passed validation`);
  logger.info({ before: candidates.length, after: kept.length }, 'Validation stage complete');
  return kept;
}

// ---------------------------------------------------------------------------
// Stage 3: DEDUPLICATE + COVERAGE ANALYSIS (deterministic)
// ---------------------------------------------------------------------------
function stageDedup(
  evals: GeneratedEvalCase[],
  budget: Record<string, number>,
  onStageUpdate?: (stage: string, detail: string) => void
): GeneratedEvalCase[] {
  onStageUpdate?.('deduplicate', `Deduplicating ${evals.length} evals`);

  // Simple dedup: group by title similarity + tools overlap
  const kept: GeneratedEvalCase[] = [];
  const titleSet = new Set<string>();

  for (const e of evals) {
    const key = e.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (titleSet.has(key)) continue;
    titleSet.add(key);
    kept.push(e);
  }

  // Enforce per-category caps from budget
  const byCat: Record<string, GeneratedEvalCase[]> = {};
  for (const e of kept) {
    if (!byCat[e.category]) byCat[e.category] = [];
    byCat[e.category].push(e);
  }

  const capped: GeneratedEvalCase[] = [];
  for (const [cat, catEvals] of Object.entries(byCat)) {
    const cap = budget[cat] || catEvals.length;
    capped.push(...catEvals.slice(0, cap));
  }

  onStageUpdate?.('deduplicate', `${capped.length} evals after dedup`);
  logger.info({ before: evals.length, after: capped.length }, 'Dedup stage complete');
  return capped;
}

// ---------------------------------------------------------------------------
// Stage 4: SELF-CRITIQUE + TARGETED REGENERATION
// ---------------------------------------------------------------------------
async function stageCritique(
  evals: GeneratedEvalCase[],
  agentProfile: AgentProfile,
  knowledgeProfile: KnowledgeProfile,
  categories: string[],
  budget: Record<string, number>,
  judgeModel: string | undefined,
  rounds: number,
  customPrompt: string | undefined,
  onStageUpdate?: (stage: string, detail: string) => void
): Promise<{ evals: GeneratedEvalCase[]; roundsRun: number }> {
  let current = evals;
  let roundsRun = 0;

  for (let round = 0; round < rounds; round++) {
    onStageUpdate?.('critique', `Self-critique round ${round + 1}/${rounds}`);

    const toolNames = agentProfile.tools.map((t) => t.name).join(', ');
    const constraints = agentProfile.constraints.map((c) => `- ${c}`).join('\n') || '(None)';
    const toolCoverage = computeToolCoverage(current, agentProfile.tools);

    let critique;
    try {
      critique = await runEvalCritiqueChain(
        {
          agentName: agentProfile.name,
          toolNames,
          toolCount: agentProfile.tools.length,
          constraints,
          categories: categories.join(', '),
          evalCount: current.length,
          evalSummaries: formatEvalForValidation(current),
          toolCoverage,
        },
        judgeModel
      );
    } catch (error) {
      logger.warn({ error, round }, 'Critique chain failed, skipping round');
      break;
    }

    roundsRun++;

    // Remove too-easy evals
    if (critique.tooEasyEvals.length > 0) {
      const removeSet = new Set(critique.tooEasyEvals);
      current = current.filter((_, i) => !removeSet.has(i));
      logger.info({ removed: critique.tooEasyEvals.length }, 'Removed trivial evals');
    }

    // Remove worst from duplicate groups
    for (const group of critique.duplicateGroups) {
      if (group.length <= 1) continue;
      const toRemove = new Set(group.slice(1)); // keep first, remove rest
      current = current.filter((_, i) => !toRemove.has(i));
    }

    // Regenerate for gaps using critique's specific prompts
    if (critique.regenerationPrompts.length > 0) {
      const gapCount = Math.min(critique.regenerationPrompts.length, 10);
      onStageUpdate?.('critique', `Regenerating ${gapCount} evals for gaps`);

      try {
        const gapEvals = await runEvalGenerationChain(
          {
            agentName: agentProfile.name,
            persona: agentProfile.persona,
            systemPrompt: agentProfile.systemPrompt.fullText,
            toolsSummary: formatToolsSummary(agentProfile.tools),
            toolCount: agentProfile.tools.length,
            constraints,
            category: 'edge_case',
            evalCount: gapCount,
            domain: knowledgeProfile.domain,
            failureModes: formatKnowledge(knowledgeProfile, 'failureModes'),
            edgeCasePatterns: formatKnowledge(knowledgeProfile, 'edgeCasePatterns'),
            userExpectations: formatKnowledge(knowledgeProfile, 'userExpectations'),
            safetyConsiderations: formatKnowledge(knowledgeProfile, 'safetyConsiderations'),
            customPrompt: `FILL THESE SPECIFIC GAPS:\n${critique.regenerationPrompts.slice(0, gapCount).map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
          },
          judgeModel
        );

        current.push(...gapEvals);
        logger.info({ added: gapEvals.length }, 'Added gap-filling evals');
      } catch (error) {
        logger.warn({ error }, 'Gap regeneration failed');
      }
    }

    // Check convergence: if no gaps and no trivial evals, stop early
    if (
      critique.coverageGaps.length === 0 &&
      critique.tooEasyEvals.length === 0 &&
      critique.duplicateGroups.length === 0
    ) {
      logger.info({ round }, 'Critique converged, stopping early');
      break;
    }
  }

  onStageUpdate?.('critique', `Critique complete after ${roundsRun} rounds, ${current.length} evals`);
  return { evals: current, roundsRun };
}

// ---------------------------------------------------------------------------
// Public API — full multi-step pipeline
// ---------------------------------------------------------------------------
export async function generateEvals(input: GenerateEvalsInput): Promise<GenerateEvalsResult> {
  const {
    agentProfile, knowledgeProfile, categories, maxEvalsPerRun,
    customPrompt, judgeModel, critiqueRounds = 2, onStageUpdate,
  } = input;

  const budget = allocateEvalBudget(categories, maxEvalsPerRun, !!customPrompt);

  // Stage 1: Over-generate
  const candidates = await stageGenerate(
    agentProfile, knowledgeProfile, budget, customPrompt, judgeModel, onStageUpdate
  );

  // Stage 2: Validate
  const validated = await stageValidate(candidates, agentProfile, judgeModel, onStageUpdate);

  // Stage 3: Deduplicate
  const deduped = stageDedup(validated, budget, onStageUpdate);

  // Stage 4: Self-critique + regeneration
  const { evals: finalEvals, roundsRun } = await stageCritique(
    deduped, agentProfile, knowledgeProfile, categories, budget,
    judgeModel, critiqueRounds, customPrompt, onStageUpdate
  );

  // Compute category counts
  const categoryCounts: Record<string, number> = {};
  for (const e of finalEvals) {
    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
  }

  const stats = {
    candidatesGenerated: candidates.length,
    afterValidation: validated.length,
    afterDedup: deduped.length,
    critiqueRoundsRun: roundsRun,
    finalCount: finalEvals.length,
  };

  logger.info({ stats, categoryCounts }, 'Multi-step eval pipeline completed');

  return {
    evals: finalEvals,
    categoryCounts,
    totalGenerated: finalEvals.length,
    pipelineStats: stats,
  };
}
