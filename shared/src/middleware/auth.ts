import { createServiceLogger } from '@whyops/shared/logger';
import type { Context, Next } from 'hono';
import type { AuthMiddlewareConfig, UnifiedAuthContext, SessionUser, UserSession } from './types';
import { extractApiKey } from './api-key-extractor';
import { getSessionAuthContext, loadUserSession, loadUserSessionFromBetterAuth, validateApiKey } from './auth-utils';

const logger = createServiceLogger('middleware:auth');

const defaultConfig: AuthMiddlewareConfig = {
  requireAuth: false,
  skipPaths: [],
  enableApiKeyAuth: true,
  enableSessionAuth: true,
  requireProjectEnv: true,
};

declare module 'hono' {
  interface ContextVariableMap {
    whyopsAuth: UnifiedAuthContext;
    sessionUser: SessionUser | null;
    sessionData: UserSession['session'] | null;
  }
}

export function createAuthMiddleware(config: Partial<AuthMiddlewareConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return async function unifiedAuthMiddleware(c: Context, next: Next) {
    if (finalConfig.skipPaths?.some((path) => c.req.path === path || c.req.path.startsWith(path))) {
      await next();
      return;
    }

    if (c.get('whyopsAuth')) {
      await next();
      return;
    }

    if (finalConfig.enableApiKeyAuth) {
      const apiKey = await extractApiKey(c);

      if (apiKey) {
        const result = await validateApiKey(apiKey);

        if (result.valid && result.context) {
          c.set('whyopsAuth', result.context);
          logger.debug(
            {
              userId: result.context.userId,
              projectId: result.context.projectId,
              authType: 'api_key',
            },
            'Request authenticated via API key'
          );
          await next();
          return;
        }

        if (finalConfig.requireAuth && !finalConfig.enableSessionAuth) {
          return c.json({ error: `Unauthorized: ${result.error}` }, 401);
        }
      }
    }

    if (finalConfig.enableSessionAuth) {
      const sessionData = await loadUserSession(c);

      if (sessionData) {
        c.set('sessionUser', sessionData.user);
        c.set('sessionData', sessionData.session);

        if (finalConfig.requireProjectEnv) {
          const authContext = await getSessionAuthContext(sessionData.user.id);

          if (authContext) {
            authContext.sessionId = sessionData.session.id;
            authContext.userEmail = sessionData.user.email;
            authContext.userName = sessionData.user.name;
            c.set('whyopsAuth', authContext);
            logger.debug(
              {
                userId: authContext.userId,
                projectId: authContext.projectId,
                authType: 'session',
              },
              'Request authenticated via session'
            );
            await next();
            return;
          }
        } else {
          c.set('whyopsAuth', {
            authType: 'session',
            userId: sessionData.user.id,
            projectId: '',
            environmentId: '',
            isMaster: true,
            sessionId: sessionData.session.id,
            userEmail: sessionData.user.email,
            userName: sessionData.user.name,
          });
          await next();
          return;
        }
      }
    }

    if (finalConfig.requireAuth) {
      return c.json({ error: 'Unauthorized: Authentication required' }, 401);
    }

    await next();
  };
}

export const authMiddleware = createAuthMiddleware({ requireAuth: true });

export const optionalAuthMiddleware = createAuthMiddleware({ requireAuth: false });

export interface BetterAuthInstance {
  api: {
    getSession: (options: { headers: Headers }) => Promise<any>;
  };
}

export function createLocalSessionMiddleware(auth: BetterAuthInstance) {
  return async function localSessionMiddleware(c: Context, next: Next) {
    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (!session) {
        c.set('sessionUser', null);
        c.set('sessionData', null);
        await next();
        return;
      }

      const sessionData = await loadUserSessionFromBetterAuth(session);

      if (sessionData) {
        c.set('sessionUser', sessionData.user);
        c.set('sessionData', sessionData.session);
      } else {
        c.set('sessionUser', null);
        c.set('sessionData', null);
      }

      await next();
    } catch (error) {
      logger.error({ error }, 'Failed to load session');
      c.set('sessionUser', null);
      c.set('sessionData', null);
      await next();
    }
  };
}

export async function requireAuth(c: Context, next: Next) {
  const auth = c.get('whyopsAuth');
  const sessionUser = c.get('sessionUser');

  if (!auth && !sessionUser) {
    logger.warn('Unauthorized access attempt');
    return c.json({ error: 'Unauthorized: Authentication required' }, 401);
  }

  await next();
}

export async function requireApiKey(c: Context, next: Next) {
  const auth = c.get('whyopsAuth');

  if (!auth || auth.authType !== 'api_key') {
    return c.json({ error: 'Unauthorized: API key required' }, 401);
  }

  await next();
}

export async function requireSession(c: Context, next: Next) {
  const auth = c.get('whyopsAuth');
  const sessionUser = c.get('sessionUser');

  if (!auth && !sessionUser) {
    return c.json({ error: 'Unauthorized: Session authentication required' }, 401);
  }

  await next();
}

export function getAuthContext(c: Context): UnifiedAuthContext | undefined {
  return c.get('whyopsAuth');
}

export function getSessionUser(c: Context): SessionUser | null {
  return c.get('sessionUser');
}

export function getSessionData(c: Context): UserSession['session'] | null {
  return c.get('sessionData');
}
