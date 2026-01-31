import { initDatabase } from '@whyops/shared/database';
import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import analyticsRouter from './routes/analytics';
import eventsRouter from './routes/events';
import healthRouter from './routes/health';
import threadsRouter from './routes/threads';

const logger = createServiceLogger('analyse');
const app = new Hono();

// Initialize database
await initDatabase();

// Global middleware
app.use('*', honoLogger());
app.use('*', cors());

// Routes
app.route('/health', healthRouter);
app.route('/api/events', eventsRouter);
app.route('/api/threads', threadsRouter);
app.route('/api/analytics', analyticsRouter);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error({ err }, 'Request error');
  return c.json({ error: 'Internal server error' }, 500);
});

const port = env.ANALYSE_PORT;

logger.info(`🚀 WhyOps Analyse Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
