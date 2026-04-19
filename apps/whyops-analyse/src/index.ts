import { serve } from '@hono/node-server';
import { getIntegrationCorsOptions } from '@whyops/shared/cors';
import { closeDatabase, initDatabase } from '@whyops/shared/database';
import env from '@whyops/shared/env';
import { createAuthMiddleware, getAuthContext } from '@whyops/shared/middleware';
import { createServiceLogger } from '@whyops/shared/logger';
import { closeRedisClient } from '@whyops/shared/services';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import analyticsRouter from './routes/analytics';
import agentAnalysesRouter from './routes/agent-analyses';
import agentSettingsRouter from './routes/agent-settings';
import evalGenerationRouter from './routes/eval-generation';
import traceReplayRouter from './routes/trace-replay';
import analysesRouter from './routes/analyses';
import entitiesRouter from './routes/entities';
import eventsRouter from './routes/events';
import healthRouter from './routes/health';
import llmCostsRouter from './routes/llmCosts';
import threadsRouter from './routes/threads';
import visualizeRouter from './routes/visualize';
import publicToolsRouter from './routes/public-tools';
import { startAnalyseEventsWorker, stopAnalyseEventsWorker } from './services/events-queue.service';

const logger = createServiceLogger('analyse');
const app = new Hono();

await initDatabase();
await startAnalyseEventsWorker();

app.use('*', honoLogger());
app.use('*', cors(getIntegrationCorsOptions()));

app.route('/api/health', healthRouter);

const analyseAuthMiddleware = createAuthMiddleware({
  requireAuth: false,
  skipPaths: ['/api/health', '/api/health/'],
  enableApiKeyAuth: true,
  enableSessionAuth: true,
  requireProjectEnv: true,
  hydrateSessionUserFromDb: false,
});

app.use('/api/*', analyseAuthMiddleware);

app.use('/api/*', async (c, next) => {
  const startedAt = performance.now();
  await next();

  const totalMs = performance.now() - startedAt;
  const authMs = c.get('authDurationMs') ?? 0;
  const existing = c.res.headers.get('Server-Timing');
  const values = [
    existing,
    `auth;dur=${authMs.toFixed(1)}`,
    `total;dur=${totalMs.toFixed(1)}`,
  ].filter(Boolean);

  c.res.headers.set('Server-Timing', values.join(', '));
});

app.use('/api/*', async (c, next) => {
  // Public tool endpoints bypass auth — they handle their own rate limiting
  if (c.req.path.startsWith('/api/public/')) {
    await next();
    return;
  }
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized: Authentication required' }, 401);
  }
  await next();
});

app.route('/api/public', publicToolsRouter);
app.route('/api/events', eventsRouter);
app.route('/api/threads', threadsRouter);
app.route('/api/analyses', analysesRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/visualize', visualizeRouter);
app.route('/api/entities', entitiesRouter);
app.route('/api/agent-settings', agentSettingsRouter);
app.route('/api/llm-costs', llmCostsRouter);
app.route('/api/agent-analyses', agentAnalysesRouter);
app.route('/api/evals', evalGenerationRouter);
app.route('/api/trace-replay', traceReplayRouter);

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

app.onError((err, c) => {
  logger.error({ err }, 'Request error');
  return c.json({ error: 'Internal server error' }, 500);
});

const port = env.ANALYSE_PORT;

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, 'WhyOps Analyse Server listening');
});

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, 'Shutting down analyse service');

  const forceExitTimer = setTimeout(() => {
    logger.error({ signal }, 'Analyse shutdown timed out');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await stopAnalyseEventsWorker();
    await closeRedisClient();
    await closeDatabase();
    logger.info({ signal }, 'Analyse service stopped cleanly');
    process.exit(0);
  } catch (error) {
    logger.error({ error, signal }, 'Analyse shutdown failed');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

export default app;
