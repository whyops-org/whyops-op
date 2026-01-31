import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

const logger = createServiceLogger('auth:jwt');

export interface JwtPayload {
  userId: string;
  email: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function jwtAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header');
    return c.json({ error: 'Unauthorized: Missing token' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    c.set('user', decoded);
    await next();
  } catch (error) {
    logger.warn({ error }, 'Invalid JWT token');
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }
}

export function generateJWT(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}
