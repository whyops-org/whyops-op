import type { Context, Next } from 'hono';
import { createServiceLogger } from '@whyops/shared/logger';

const logger = createServiceLogger('proxy:request');

export async function requestLogMiddleware(c: Context, next: Next) {
  const startTime = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const latencyMs = Date.now() - startTime;
  const statusCode = c.res.status;

  logger.info({
    method,
    path,
    statusCode,
    latencyMs,
    userAgent: c.req.header('user-agent'),
  });

  // Set response headers
  c.header('X-Response-Time', `${latencyMs}ms`);
  c.header('X-Request-Id', crypto.randomUUID());
}
