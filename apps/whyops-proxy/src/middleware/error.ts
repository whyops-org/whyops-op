import type { Context, ErrorHandler } from 'hono';
import { createServiceLogger } from '@whyops/shared/logger';

const logger = createServiceLogger('proxy:error');

export const errorHandler: ErrorHandler = (err, c: Context) => {
  logger.error({ err, path: c.req.path }, 'Request error');

  if (err instanceof SyntaxError) {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  return c.json(
    {
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
};
