import { serve } from '@hono/node-server';
import { getIntegrationCorsOptions } from '@whyops/shared/cors';
import env from '@whyops/shared/env';
import { createAuthMiddleware, getAuthContext } from '@whyops/shared/middleware';
import { createServiceLogger } from '@whyops/shared/logger';
import { closeRedisClient } from '@whyops/shared/services';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { errorHandler } from './middleware/error';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { requestLogMiddleware } from './middleware/requestLog';
import agentsRouter from './routes/agents';
import anthropicRouter from './routes/anthropic';
import healthRouter from './routes/health';
import openaiRouter from './routes/openai';

const logger = createServiceLogger('proxy');
const app = new Hono();

app.use('*', honoLogger());
app.use('*', cors(getIntegrationCorsOptions()));
app.use('*', requestLogMiddleware);

app.use('/v1/*', async (c, next) => {
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

app.route('/health', healthRouter);

const proxyAuthMiddleware = createAuthMiddleware({
  requireAuth: true,
  skipPaths: ['/health'],
  enableApiKeyAuth: true,
  enableSessionAuth: false,
  requireProjectEnv: true,
});

app.use('/v1/*', proxyAuthMiddleware);
app.use('/v1/*', rateLimitMiddleware);

app.route('/v1', openaiRouter);
app.route('/v1', anthropicRouter);
app.route('/v1', agentsRouter);

app.onError(errorHandler);

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

const port = env.PROXY_PORT;

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, 'WhyOps Proxy Server listening');
});

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, 'Shutting down proxy service');

  const forceExitTimer = setTimeout(() => {
    logger.error({ signal }, 'Proxy shutdown timed out');
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

    await closeRedisClient();
    logger.info({ signal }, 'Proxy service stopped cleanly');
    process.exit(0);
  } catch (error) {
    logger.error({ error, signal }, 'Proxy shutdown failed');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

export default app;
