import env from '@whyops/shared/env';
import { Hono } from 'hono';
import { SessionContextService, UserService } from '../services';
import { ResponseUtil } from '../utils';

const app = new Hono();
const SESSION_CONTEXT_CACHE_TTL_MS = env.AUTH_GET_SESSION_CACHE_TTL_MS;
const sessionContextCache = new Map<string, { expiresAtMs: number; payload: unknown }>();
const sessionContextInFlight = new Map<string, Promise<unknown>>();

function extractSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    /(?:^|;\s*)(?:__Secure-better-auth\.session_token|better-auth\.session_token)=([^;]+)/
  );
  return match?.[1] || null;
}

app.get('/context', async (c) => {
  const sessionUser = c.get('sessionUser');
  const sessionData = c.get('sessionData');

  if (!sessionUser || !sessionData) {
    return ResponseUtil.unauthorized(c, 'Not authenticated');
  }

  const token = extractSessionToken(c.req.header('Cookie'));
  const cacheKey = token ? `session:${token}` : null;

  if (cacheKey) {
    const cached = sessionContextCache.get(cacheKey);
    if (cached && Date.now() <= cached.expiresAtMs) {
      return c.json(cached.payload, 200);
    }

    const existingInFlight = sessionContextInFlight.get(cacheKey);
    if (existingInFlight) {
      const payload = await existingInFlight;
      return c.json(payload, 200);
    }
  }

  const payloadPromise = (async () => {
    const appUser = await UserService.getUserById(sessionUser.id);
    const metadata = (appUser?.metadata || sessionUser.metadata || {}) as Record<string, unknown>;
    const user = {
      id: sessionUser.id,
      email: sessionUser.email,
      name: appUser?.name ?? sessionUser.name,
      metadata,
      onboardingComplete: Boolean(metadata.onboardingComplete),
      isActive: appUser?.isActive ?? sessionUser.isActive,
    };

    const baseContext = await SessionContextService.getSessionAuthContext(sessionUser.id);
    const authContext = baseContext
      ? {
          ...baseContext,
          sessionId: sessionData.id,
          userEmail: user.email,
          userName: user.name,
        }
      : null;

    return {
      user,
      session: sessionData,
      authContext,
    };
  })();

  if (cacheKey) {
    sessionContextInFlight.set(cacheKey, payloadPromise);
  }

  try {
    const payload = await payloadPromise;
    if (cacheKey) {
      sessionContextCache.set(cacheKey, {
        expiresAtMs: Date.now() + SESSION_CONTEXT_CACHE_TTL_MS,
        payload,
      });
    }
    return c.json(payload, 200);
  } finally {
    if (cacheKey) {
      sessionContextInFlight.delete(cacheKey);
    }
  }
});

export default app;
