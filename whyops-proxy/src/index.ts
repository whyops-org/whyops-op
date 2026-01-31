import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { cors } from 'hono/cors';
import { createServiceLogger } from '@whyops/shared/logger';
import env from '@whyops/shared/env';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { requestLogMiddleware } from './middleware/requestLog';
import { errorHandler } from './middleware/error';
import openaiRouter from './routes/openai';
import anthropicRouter from './routes/anthropic';
import healthRouter from './routes/health';

const logger = createServiceLogger('proxy');
const app = new Hono();

// Global middleware
app.use('*', honoLogger());
app.use('*', cors());
app.use('*', requestLogMiddleware);

// Health check (no auth required)
app.route('/health', healthRouter);

// Protected routes - require authentication
app.use('/v1/*', authMiddleware);
app.use('/v1/*', rateLimitMiddleware);

// Provider routes
app.route('/v1', openaiRouter);
app.route('/v1', anthropicRouter);

// Error handler
app.onError(errorHandler);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

const port = env.PROXY_PORT;

logger.info(`🚀 WhyOps Proxy Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
