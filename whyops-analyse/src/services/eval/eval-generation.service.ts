import { createServiceLogger } from '@whyops/shared/logger';
import {
  Agent,
  AgentKnowledgeProfile,
  EvalCase,
  EvalConfig,
  EvalRun,
} from '@whyops/shared/models';
import { extractAgentProfile } from './agent-profile-extractor';
import {
  buildKnowledgeProfile,
  getCachedKnowledgeProfile,
  isKnowledgeBuildInProgress,
  startBackgroundKnowledgeBuild,
  getKnowledgeProfile,
} from './knowledge-builder';
import { generateEvals, ALL_CATEGORIES, type EvalCategory } from './eval-generator';
import { exportAsJson, exportAsPromptfoo } from './eval-export';

const logger = createServiceLogger('analyse:eval:generation-service');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RunEvalGenerationInput {
  userId: string;
  projectId: string;
  environmentId: string;
  agentId: string;
  categories?: EvalCategory[];
  maxEvalsPerRun?: number;
  customPrompt?: string;
  judgeModel?: string;
  trigger?: 'manual' | 'scheduled' | 'entity_change';
  critiqueRounds?: number;
  onCheckpoint?: (event: EvalCheckpointEvent) => void;
}

export interface EvalCheckpointEvent {
  stage: string;
  detail: string;
  progress?: number;
  snapshot?: any;
}

interface EvalGenerationResult {
  runId: string;
  status: string;
  evalCount: number;
  categoryCounts: Record<string, number>;
  summary: Record<string, any>;
}

interface ScopeFilter {
  userId: string;
  projectId: string;
  environmentId: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export const EvalGenerationService = {
  /**
   * Main generation endpoint. Handles the background intelligence flow:
   * - If no intelligence: starts background build, returns null (caller sends 202)
   * - If intelligence exists: runs full pipeline, streams checkpoints
   */
  async runGeneration(input: RunEvalGenerationInput): Promise<EvalGenerationResult | null> {
    const {
      userId, projectId, environmentId, agentId,
      categories = ALL_CATEGORIES,
      maxEvalsPerRun = 50, customPrompt, judgeModel,
      trigger = 'manual', critiqueRounds = 2, onCheckpoint,
    } = input;

    // Validate agent
    const agent = await Agent.findOne({
      where: { id: agentId, userId, projectId, environmentId },
    });
    if (!agent) throw new Error('AGENT_NOT_FOUND');

    // Extract agent profile (fast — reads DB only)
    const agentProfile = await extractAgentProfile({ agentId, userId, projectId, environmentId });

    // Check intelligence availability
    const cachedKnowledge = await getCachedKnowledgeProfile(agentId);

    if (!cachedKnowledge) {
      // No fresh intelligence — check if build is already in progress
      if (isKnowledgeBuildInProgress(agentId)) {
        return null; // caller returns 202
      }

      // Start background intelligence build
      startBackgroundKnowledgeBuild({
        agentProfile,
        userId,
        projectId,
        environmentId,
        judgeModel,
        sendEmailOnComplete: true,
      });

      return null; // caller returns 202
    }

    // Intelligence is ready — run eval generation pipeline
    const run = await EvalRun.create({
      agentId,
      userId,
      projectId,
      environmentId,
      entityId: agentProfile.entityId,
      status: 'running',
      trigger,
      customPrompt,
      startedAt: new Date(),
    });

    try {
      onCheckpoint?.({ stage: 'started', detail: 'Eval generation pipeline started' });

      // Run multi-step pipeline with stage callbacks
      const result = await generateEvals({
        agentProfile,
        knowledgeProfile: cachedKnowledge,
        categories,
        maxEvalsPerRun,
        customPrompt,
        judgeModel,
        critiqueRounds,
        onStageUpdate: (stage, detail) => {
          onCheckpoint?.({ stage, detail });
        },
      });

      // Store eval cases
      onCheckpoint?.({ stage: 'storing', detail: `Storing ${result.totalGenerated} eval cases` });

      if (result.evals.length > 0) {
        await EvalCase.bulkCreate(
          result.evals.map((e) => ({
            runId: run.id,
            agentId,
            category: e.category,
            subcategory: e.subcategory || undefined,
            title: e.title,
            description: e.description,
            conversation: e.conversation,
            expectedOutcome: e.expected_outcome,
            scoringRubric: e.scoring_rubric,
            difficulty: e.difficulty,
            toolsTested: e.tools_tested,
            metadata: {
              generationVersion: 'v2.0',
              judgeModel,
              pipelineStats: result.pipelineStats,
            },
          }))
        );
      }

      // Finalize
      const summary = {
        categoryCounts: result.categoryCounts,
        totalGenerated: result.totalGenerated,
        domain: cachedKnowledge.domain,
        pipelineStats: result.pipelineStats,
        toolsCoverage: computeToolsCoverage(result.evals, agentProfile.tools),
      };

      await run.update({
        status: 'completed',
        evalCount: result.totalGenerated,
        summary,
        finishedAt: new Date(),
      });

      onCheckpoint?.({
        stage: 'completed',
        detail: `Generated ${result.totalGenerated} eval cases`,
        snapshot: { runId: run.id, status: 'completed', summary },
      });

      return {
        runId: run.id,
        status: 'completed',
        evalCount: result.totalGenerated,
        categoryCounts: result.categoryCounts,
        summary,
      };
    } catch (error: any) {
      logger.error({ agentId, runId: run.id, error }, 'Eval generation failed');
      await run.update({
        status: 'failed',
        error: error?.message || String(error),
        finishedAt: new Date(),
      });
      throw error;
    }
  },

  async getLatestRun(agentId: string, scope: ScopeFilter) {
    return EvalRun.findOne({
      where: { agentId, ...scope },
      order: [['createdAt', 'DESC']],
      include: [{ model: EvalCase, as: 'cases' }],
    });
  },

  async getRunById(runId: string, scope: ScopeFilter) {
    return EvalRun.findOne({
      where: { id: runId, ...scope },
      include: [{ model: EvalCase, as: 'cases' }],
    });
  },

  async listRunsForAgent(agentId: string, scope: ScopeFilter & { count: number; page: number }) {
    const { count, page, ...scopeFilter } = scope;
    const { rows, count: total } = await EvalRun.findAndCountAll({
      where: { agentId, ...scopeFilter },
      order: [['createdAt', 'DESC']],
      limit: count,
      offset: (page - 1) * count,
    });
    return { runs: rows, total, page, pageSize: count };
  },

  async listCasesForAgent(
    agentId: string,
    scope: ScopeFilter & { count: number; page: number; category?: string }
  ) {
    const { count, page, category, ...scopeFilter } = scope;
    const where: Record<string, any> = { agentId };
    if (category) where.category = category;
    const { rows, count: total } = await EvalCase.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: count,
      offset: (page - 1) * count,
    });
    return { cases: rows, total, page, pageSize: count };
  },

  async getConfigForAgent(agentId: string, scope: ScopeFilter) {
    return EvalConfig.findOne({ where: { agentId, ...scope } });
  },

  async upsertConfig(input: {
    userId: string;
    projectId: string;
    environmentId: string;
    agentId: string;
    enabled: boolean;
    cronExpr: string;
    timezone: string;
    categories?: string[];
    maxEvalsPerRun?: number;
    customPrompt?: string;
  }) {
    const agent = await Agent.findOne({
      where: { id: input.agentId, userId: input.userId, projectId: input.projectId, environmentId: input.environmentId },
    });
    if (!agent) throw new Error('AGENT_NOT_FOUND');

    const [config] = await EvalConfig.upsert({
      agentId: input.agentId,
      userId: input.userId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      enabled: input.enabled,
      cronExpr: input.cronExpr,
      timezone: input.timezone,
      categories: input.categories as any,
      maxEvalsPerRun: input.maxEvalsPerRun,
      customPrompt: input.customPrompt,
    });
    return config;
  },

  async getKnowledgeProfile(agentId: string) {
    return AgentKnowledgeProfile.findOne({ where: { agentId } });
  },

  async rebuildKnowledgeProfile(input: {
    userId: string;
    projectId: string;
    environmentId: string;
    agentId: string;
    judgeModel?: string;
  }) {
    const agentProfile = await extractAgentProfile({
      agentId: input.agentId,
      userId: input.userId,
      projectId: input.projectId,
      environmentId: input.environmentId,
    });

    return buildKnowledgeProfile({
      agentProfile,
      userId: input.userId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      forceRebuild: true,
      judgeModel: input.judgeModel,
    });
  },

  isKnowledgeBuildInProgress,
  exportAsJson,
  exportAsPromptfoo,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function computeToolsCoverage(
  evals: Array<{ tools_tested: string[] }>,
  allTools: Array<{ name: string }>
): { covered: string[]; uncovered: string[]; coveragePercent: number } {
  const allToolNames = new Set(allTools.map((t) => t.name));
  const tested = new Set<string>();
  for (const e of evals) for (const t of e.tools_tested) tested.add(t);

  const covered = [...tested].filter((t) => allToolNames.has(t));
  const uncovered = [...allToolNames].filter((t) => !tested.has(t));
  const pct = allToolNames.size > 0 ? (covered.length / allToolNames.size) * 100 : 100;
  return { covered, uncovered, coveragePercent: Math.round(pct) };
}
