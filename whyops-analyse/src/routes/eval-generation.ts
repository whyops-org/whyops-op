import { zValidator } from '@hono/zod-validator';
import { createServiceLogger } from '@whyops/shared/logger';
import { Hono } from 'hono';
import { z } from 'zod';
import { EvalGenerationService } from '../services/eval';

const logger = createServiceLogger('analyse:eval-generation-routes');
const app = new Hono();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const agentIdParamsSchema = z.object({
  agentId: z.string().uuid('Invalid agentId'),
});

const runIdParamsSchema = z.object({
  agentId: z.string().uuid('Invalid agentId'),
  runId: z.string().uuid('Invalid runId'),
});

const generateBodySchema = z.object({
  categories: z
    .array(
      z.enum([
        'happy_path',
        'edge_case',
        'multi_step',
        'safety',
        'error_handling',
        'adversarial',
        'feature_specific',
      ])
    )
    .min(1)
    .max(7)
    .optional(),
  maxEvalsPerRun: z.number().int().min(5).max(200).optional(),
  customPrompt: z.string().max(10000).optional(),
  judgeModel: z.string().max(64).optional(),
});

const configBodySchema = z.object({
  enabled: z.boolean(),
  cronExpr: z.string().min(5).max(128),
  timezone: z.string().min(1).max(64),
  categories: z
    .array(
      z.enum([
        'happy_path',
        'edge_case',
        'multi_step',
        'safety',
        'error_handling',
        'adversarial',
        'feature_specific',
      ])
    )
    .min(1)
    .max(7)
    .optional(),
  maxEvalsPerRun: z.number().int().min(5).max(200).optional(),
  customPrompt: z.string().max(10000).optional(),
});

// ---------------------------------------------------------------------------
// POST /:agentId/generate — trigger eval generation
// Supports ndjson streaming via Accept: application/x-ndjson or ?stream=true
// Returns 202 if intelligence is still building in background
// ---------------------------------------------------------------------------
app.post(
  '/:agentId/generate',
  zValidator('param', agentIdParamsSchema),
  zValidator('json', generateBodySchema),
  async (c) => {
    const auth = c.get('whyopsAuth');
    if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

    try {
      const { agentId } = c.req.valid('param');
      const body = c.req.valid('json');
      const accept = c.req.header('accept') || '';
      const wantsStream = c.req.query('stream') === 'true' || accept.includes('application/x-ndjson');

      if (wantsStream) {
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          start(controller) {
            let closed = false;

            const writeChunk = (chunk: unknown) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
              } catch {
                closed = true;
              }
            };

            const close = () => {
              if (closed) return;
              closed = true;
              try { controller.close(); } catch { /* already closed */ }
            };

            void (async () => {
              try {
                const result = await EvalGenerationService.runGeneration({
                  userId: auth.userId,
                  projectId: auth.projectId,
                  environmentId: auth.environmentId,
                  agentId,
                  categories: body.categories as any,
                  maxEvalsPerRun: body.maxEvalsPerRun,
                  customPrompt: body.customPrompt,
                  judgeModel: body.judgeModel,
                  trigger: 'manual',
                  onCheckpoint: (event) => {
                    writeChunk({ success: true, checkpoint: event });
                  },
                });

                if (result === null) {
                  // Intelligence building in background
                  writeChunk({
                    success: true,
                    status: 'intelligence_building',
                    message: 'Intelligence gathering started in background. You will receive an email when it is ready. Then retry this request.',
                  });
                } else {
                  writeChunk({ success: true, result });
                }
              } catch (error: any) {
                if (error?.message === 'AGENT_NOT_FOUND') {
                  writeChunk({ success: false, error: 'Agent not found' });
                } else if (error?.message?.startsWith('JUDGE_NOT_CONFIGURED')) {
                  writeChunk({ success: false, error: 'LLM Judge not configured.' });
                } else {
                  logger.error({ error }, 'Eval generation stream failed');
                  writeChunk({ success: false, error: 'Failed to generate evals' });
                }
              } finally {
                close();
              }
            })();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            'content-type': 'application/x-ndjson; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive',
            'x-accel-buffering': 'no',
          },
        });
      }

      // Non-streaming: standard JSON response
      const result = await EvalGenerationService.runGeneration({
        userId: auth.userId,
        projectId: auth.projectId,
        environmentId: auth.environmentId,
        agentId,
        categories: body.categories as any,
        maxEvalsPerRun: body.maxEvalsPerRun,
        customPrompt: body.customPrompt,
        judgeModel: body.judgeModel,
        trigger: 'manual',
      });

      if (result === null) {
        return c.json({
          success: true,
          status: 'intelligence_building',
          message: 'Intelligence gathering started in background. You will receive an email when it is ready. Then retry this request.',
        }, 202);
      }

      return c.json({ success: true, ...result }, 201);
    } catch (error: any) {
      if (error?.message === 'AGENT_NOT_FOUND') {
        return c.json({ success: false, error: 'Agent not found' }, 404);
      }
      if (error?.message?.startsWith('JUDGE_NOT_CONFIGURED')) {
        return c.json({
          success: false,
          error: 'LLM Judge not configured. Set JUDGE_LLM_API_KEY environment variable.',
        }, 500);
      }
      logger.error({ error }, 'Failed to run eval generation');
      return c.json({ success: false, error: 'Failed to generate evals' }, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:agentId/latest — get latest eval run
// ---------------------------------------------------------------------------
app.get('/:agentId/latest', zValidator('param', agentIdParamsSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { agentId } = c.req.valid('param');
    const run = await EvalGenerationService.getLatestRun(agentId, {
      userId: auth.userId,
      projectId: auth.projectId,
      environmentId: auth.environmentId,
    });

    if (!run) return c.json({ success: false, error: 'No eval run found' }, 404);
    return c.json({ success: true, run });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch latest eval run');
    return c.json({ success: false, error: 'Failed to fetch latest run' }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /:agentId/runs — list eval runs
// ---------------------------------------------------------------------------
app.get('/:agentId/runs', zValidator('param', agentIdParamsSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { agentId } = c.req.valid('param');
    const count = Math.min(Math.max(parseInt(c.req.query('count') || '20', 10) || 20, 1), 100);
    const page = Math.max(parseInt(c.req.query('page') || '1', 10) || 1, 1);

    const result = await EvalGenerationService.listRunsForAgent(agentId, {
      userId: auth.userId,
      projectId: auth.projectId,
      environmentId: auth.environmentId,
      count,
      page,
    });

    return c.json({ success: true, ...result });
  } catch (error: any) {
    logger.error({ error }, 'Failed to list eval runs');
    return c.json({ success: false, error: 'Failed to list runs' }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /:agentId/runs/:runId — get specific run with cases
// ---------------------------------------------------------------------------
app.get(
  '/:agentId/runs/:runId',
  zValidator('param', runIdParamsSchema),
  async (c) => {
    const auth = c.get('whyopsAuth');
    if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

    try {
      const { runId } = c.req.valid('param');
      const run = await EvalGenerationService.getRunById(runId, {
        userId: auth.userId,
        projectId: auth.projectId,
        environmentId: auth.environmentId,
      });

      if (!run) return c.json({ success: false, error: 'Run not found' }, 404);
      return c.json({ success: true, run });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch eval run');
      return c.json({ success: false, error: 'Failed to fetch run' }, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:agentId/cases — list eval cases (paginated, filterable)
// ---------------------------------------------------------------------------
app.get('/:agentId/cases', zValidator('param', agentIdParamsSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { agentId } = c.req.valid('param');
    const count = Math.min(Math.max(parseInt(c.req.query('count') || '50', 10) || 50, 1), 200);
    const page = Math.max(parseInt(c.req.query('page') || '1', 10) || 1, 1);
    const category = c.req.query('category') || undefined;

    const result = await EvalGenerationService.listCasesForAgent(agentId, {
      userId: auth.userId,
      projectId: auth.projectId,
      environmentId: auth.environmentId,
      count,
      page,
      category,
    });

    return c.json({ success: true, ...result });
  } catch (error: any) {
    logger.error({ error }, 'Failed to list eval cases');
    return c.json({ success: false, error: 'Failed to list cases' }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /:agentId/config — get eval config
// ---------------------------------------------------------------------------
app.get('/:agentId/config', zValidator('param', agentIdParamsSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { agentId } = c.req.valid('param');
    const config = await EvalGenerationService.getConfigForAgent(agentId, {
      userId: auth.userId,
      projectId: auth.projectId,
      environmentId: auth.environmentId,
    });

    return c.json({ success: true, config: config || null });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch eval config');
    return c.json({ success: false, error: 'Failed to fetch config' }, 500);
  }
});

// ---------------------------------------------------------------------------
// PUT /:agentId/config — upsert eval config
// ---------------------------------------------------------------------------
app.put(
  '/:agentId/config',
  zValidator('param', agentIdParamsSchema),
  zValidator('json', configBodySchema),
  async (c) => {
    const auth = c.get('whyopsAuth');
    if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

    try {
      const { agentId } = c.req.valid('param');
      const body = c.req.valid('json');

      const config = await EvalGenerationService.upsertConfig({
        userId: auth.userId,
        projectId: auth.projectId,
        environmentId: auth.environmentId,
        agentId,
        enabled: body.enabled,
        cronExpr: body.cronExpr,
        timezone: body.timezone,
        categories: body.categories,
        maxEvalsPerRun: body.maxEvalsPerRun,
        customPrompt: body.customPrompt,
      });

      return c.json({ success: true, config });
    } catch (error: any) {
      if (error?.message === 'AGENT_NOT_FOUND') {
        return c.json({ success: false, error: 'Agent not found' }, 404);
      }
      logger.error({ error }, 'Failed to upsert eval config');
      return c.json({ success: false, error: 'Failed to save config' }, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:agentId/export/json — export evals as JSON
// ---------------------------------------------------------------------------
app.get('/:agentId/export/json', zValidator('param', agentIdParamsSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { agentId } = c.req.valid('param');
    const runId = c.req.query('runId') || undefined;

    const cases = await EvalGenerationService.exportAsJson(agentId, runId);
    return c.json({ success: true, evals: cases, count: cases.length });
  } catch (error: any) {
    logger.error({ error }, 'Failed to export evals as JSON');
    return c.json({ success: false, error: 'Failed to export' }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /:agentId/export/promptfoo — export evals as Promptfoo YAML
// ---------------------------------------------------------------------------
app.get('/:agentId/export/promptfoo', zValidator('param', agentIdParamsSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { agentId } = c.req.valid('param');
    const runId = c.req.query('runId') || undefined;

    // Get agent name and system prompt for the Promptfoo config
    const { Agent, Entity } = await import('@whyops/shared/models');
    const agent = await Agent.findByPk(agentId);
    if (!agent) return c.json({ success: false, error: 'Agent not found' }, 404);

    const entity = await Entity.findOne({
      where: { agentId },
      order: [['createdAt', 'DESC']],
    });

    const systemPrompt =
      entity?.metadata?.systemPrompt ||
      entity?.metadata?.system_prompt ||
      'You are a helpful assistant.';

    const yaml = await EvalGenerationService.exportAsPromptfoo(
      agentId,
      agent.name,
      systemPrompt,
      runId
    );

    return new Response(yaml, {
      status: 200,
      headers: {
        'content-type': 'text/yaml; charset=utf-8',
        'content-disposition': `attachment; filename="${agent.name}-evals.yaml"`,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to export evals as Promptfoo YAML');
    return c.json({ success: false, error: 'Failed to export' }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /:agentId/knowledge-profile — get knowledge profile
// ---------------------------------------------------------------------------
app.get('/:agentId/knowledge-profile', zValidator('param', agentIdParamsSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { agentId } = c.req.valid('param');
    const profile = await EvalGenerationService.getKnowledgeProfile(agentId);

    if (!profile) return c.json({ success: true, profile: null });
    return c.json({ success: true, profile });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch knowledge profile');
    return c.json({ success: false, error: 'Failed to fetch knowledge profile' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /:agentId/knowledge-profile/rebuild — force rebuild knowledge profile
// ---------------------------------------------------------------------------
app.post('/:agentId/knowledge-profile/rebuild', zValidator('param', agentIdParamsSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { agentId } = c.req.valid('param');
    const judgeModel = c.req.query('judgeModel') || undefined;

    const profile = await EvalGenerationService.rebuildKnowledgeProfile({
      userId: auth.userId,
      projectId: auth.projectId,
      environmentId: auth.environmentId,
      agentId,
      judgeModel,
    });

    return c.json({ success: true, profile });
  } catch (error: any) {
    if (error?.message === 'AGENT_NOT_FOUND') {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }
    logger.error({ error }, 'Failed to rebuild knowledge profile');
    return c.json({ success: false, error: 'Failed to rebuild knowledge profile' }, 500);
  }
});

export default app;
