import { getIntegrationCorsOptions } from '@whyops/shared/cors';
import { initDatabase } from '@whyops/shared/database';
import env from '@whyops/shared/env';
import { createLocalSessionMiddleware, requireAuth, requireSession } from '@whyops/shared/middleware';
import { createServiceLogger } from '@whyops/shared/logger';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { auth } from './lib/auth';
import apiKeysRouter from './routes/apiKeys';
import authRouter from './routes/auth';
import configRouter from './routes/config';
import devRouter from './routes/dev';
import healthRouter from './routes/health';
import migrateRouter from './routes/migrate';
import projectsRouter from './routes/projects';
import providersRouter from './routes/providers';
import usersRouter from './routes/users';
import { verifyEmailConnection } from './utils/email.util';

const logger = createServiceLogger('auth');
const app = new Hono();

type MagicLinkRateState = Map<string, { count: number; start: number }>;
const MAGIC_LINK_RATE_LIMIT: MagicLinkRateState = new Map();

await initDatabase();
logger.info('Database initialized');

const emailConfigured = await verifyEmailConnection();
if (!emailConfigured) {
  logger.warn('Maileroo not configured. Magic link authentication will not work.');
  logger.warn('Please set MAILEROO_API_KEY environment variable.');
} else {
  logger.info('Maileroo email service configured successfully');
}

app.use('*', honoLogger());
app.use('*', cors(getIntegrationCorsOptions()));

const magicLinkLimiter: MiddlewareHandler = async (c: Context, next) => {
  const ipHeader =
    c.req.header('x-forwarded-for') ||
    c.req.header('x-real-ip') ||
    c.req.raw.headers.get('cf-connecting-ip') ||
    c.req.raw.headers.get('x-forwarded-for') ||
    'unknown';
  const ip = ipHeader.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  const entry = MAGIC_LINK_RATE_LIMIT.get(ip);

  if (!entry || now - entry.start > windowMs) {
    MAGIC_LINK_RATE_LIMIT.set(ip, { count: 1, start: now });
  } else if (entry.count >= 3) {
    return c.json({ error: 'Too many requests. Try again later.' }, 429);
  } else {
    entry.count += 1;
    MAGIC_LINK_RATE_LIMIT.set(ip, entry);
  }

  await next();
};

app.use('/api/auth/sign-in/magic-link', magicLinkLimiter);

app.route('/health', healthRouter);
app.route('/api/config', configRouter);

app.route('/api/auth', authRouter);

if (env.NODE_ENV === 'development') {
  app.route('/migrate', migrateRouter);
  app.route('/api/dev', devRouter);
}

app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

const sessionMiddleware = createLocalSessionMiddleware(auth);
app.use('/api/*', sessionMiddleware);

app.use('/api/*', requireSession);
app.route('/api/projects', projectsRouter);
app.route('/api/providers', providersRouter);
app.route('/api/api-keys', apiKeysRouter);
app.route('/api/users', usersRouter);

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

app.onError((err, c) => {
  logger.error({ err }, 'Request error');
  return c.json({ error: 'Internal server error' }, 500);
});

const port = env.AUTH_PORT;

logger.info(`🚀 WhyOps Auth Server starting on port ${port}, working fine...`);

export default {
  port,
  fetch: app.fetch,
};
