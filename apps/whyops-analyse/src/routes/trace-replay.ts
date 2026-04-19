import { zValidator } from '@hono/zod-validator';
import { createServiceLogger } from '@whyops/shared/logger';
import { TraceReplayRun } from '@whyops/shared/models';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildReplayContext } from '../services/trace-replay-context';
import { executeReplay } from '../services/trace-replay-executor';
import { scoreReplay } from '../services/trace-replay-scorer';

const logger = createServiceLogger('analyse:trace-replay-routes');
const app = new Hono();

const runBodySchema = z.object({
  analysisId: z.string().uuid().optional(),
  judgeModel: z.string().max(64).optional(),
  variantConfig: z.object({
    systemPrompt: z.string().optional(),
    toolDescriptions: z.record(z.string()).optional(),
    tools: z.array(z.any()).optional(),
    patchSummary: z.string().optional(),
  }).default({}),
});

const traceIdSchema = z.object({ traceId: z.string().min(1).max(128) });
const runIdSchema = z.object({ runId: z.string().uuid() });

// POST /api/trace-replay/:traceId/run
app.post('/:traceId/run', zValidator('param', traceIdSchema), zValidator('json', runBodySchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const { traceId } = c.req.valid('param');
  const body = c.req.valid('json');
  const wantsStream =
    c.req.query('stream') === 'true' ||
    (c.req.header('accept') ?? '').includes('application/x-ndjson');

  const variantConfig = { ...body.variantConfig, analysisId: body.analysisId };

  const run = await TraceReplayRun.create({
    traceId,
    analysisId: body.analysisId,
    userId: auth.userId,
    projectId: auth.projectId,
    environmentId: auth.environmentId,
    status: 'pending',
    variantConfig,
  });

  const runReplay = async (emit: (chunk: object) => void) => {
    await run.update({ status: 'running', startedAt: new Date() });
    emit({ success: true, run: formatRun(run) });

    try {
      const ctx = await buildReplayContext(traceId, auth.userId, variantConfig);
      emit({ success: true, run: formatRun(run), checkpoint: 'context_built' });

      const result = await executeReplay(ctx, body.judgeModel);
      emit({ success: true, run: formatRun(run), checkpoint: 'execution_done' });

      const comparison = scoreReplay(ctx.originalEvents, result);

      await run.update({
        status: 'completed',
        replayEvents: result.events,
        comparison,
        score: comparison.score,
        finishedAt: new Date(),
      });

      emit({ success: true, run: formatRun(run), status: 'completed' });
    } catch (err: any) {
      logger.error({ err, traceId, runId: run.id }, 'Replay run failed');
      await run.update({ status: 'failed', error: err?.message ?? 'UNKNOWN_ERROR', finishedAt: new Date() });
      emit({ success: false, run: formatRun(run), error: err?.message ?? 'Replay failed' });
    }
  };

  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (chunk: object) => {
          try { controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`)); } catch {}
        };
        await runReplay(emit);
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked' },
    });
  }

  // Non-streaming: run to completion then return
  const results: object[] = [];
  await runReplay((chunk) => results.push(chunk));
  return c.json(results[results.length - 1] ?? { success: true, run: formatRun(run) });
});

// GET /api/trace-replay/:traceId/runs
app.get('/:traceId/runs', zValidator('param', traceIdSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const { traceId } = c.req.valid('param');
  const runs = await TraceReplayRun.findAll({
    where: { traceId, userId: auth.userId },
    attributes: ['id', 'traceId', 'analysisId', 'status', 'variantConfig', 'comparison', 'score', 'error', 'startedAt', 'finishedAt', 'createdAt'],
    order: [['created_at', 'DESC']],
    limit: 50,
  });

  return c.json({ success: true, runs: runs.map(formatRun) });
});

// GET /api/trace-replay/runs/:runId
app.get('/runs/:runId', zValidator('param', runIdSchema), async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const { runId } = c.req.valid('param');
  const run = await TraceReplayRun.findOne({ where: { id: runId, userId: auth.userId } });

  if (!run) return c.json({ success: false, error: 'Not found' }, 404);
  return c.json({ success: true, run: formatRun(run) });
});

function formatRun(run: TraceReplayRun) {
  return {
    id: run.id,
    traceId: run.traceId,
    analysisId: run.analysisId,
    status: run.status,
    variantConfig: run.variantConfig,
    replayEvents: run.replayEvents,
    comparison: run.comparison,
    score: run.score,
    error: run.error,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
  };
}

export default app;
