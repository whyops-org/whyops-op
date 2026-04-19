import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import { getInternalServiceUrl } from '@whyops/shared/service-urls';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import type { SessionAuthContext, SessionUser, UserSession } from './types';

const logger = createServiceLogger('auth:remote-session-context');
const REMOTE_SESSION_CONTEXT_CACHE_TTL_MS = env.AUTH_REMOTE_SESSION_CACHE_TTL_MS;

export interface RemoteSessionContextPayload {
  user: SessionUser;
  session: UserSession['session'];
  authContext: SessionAuthContext | null;
}

const remoteSessionContextCache = new Map<
  string,
  { expiresAtMs: number; value: RemoteSessionContextPayload | null }
>();
const remoteSessionContextInFlight = new Map<string, Promise<RemoteSessionContextPayload | null>>();

function extractSessionTokenFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    /(?:^|;\s*)(?:__Secure-better-auth\.session_token|better-auth\.session_token)=([^;]+)/
  );
  return match?.[1] || null;
}

function getRemoteSessionContextCacheKey(headers: Headers): string | null {
  const cookie = headers.get('Cookie') || headers.get('cookie');
  const token = extractSessionTokenFromCookieHeader(cookie);
  return token ? `session:${token}` : null;
}

function clonePayload(
  payload: RemoteSessionContextPayload | null
): RemoteSessionContextPayload | null {
  if (!payload) return null;
  return {
    user: { ...payload.user },
    session: { ...payload.session },
    authContext: payload.authContext ? { ...payload.authContext } : null,
  };
}

async function getRemoteSessionContextFromAuthServer(
  headers: Headers
): Promise<RemoteSessionContextPayload | null> {
  const authUrl = getInternalServiceUrl('auth');
  const url = `${authUrl}/api/session/context`;
  const cacheKey = getRemoteSessionContextCacheKey(headers);

  if (cacheKey) {
    const cached = remoteSessionContextCache.get(cacheKey);
    if (cached && Date.now() <= cached.expiresAtMs) {
      return clonePayload(cached.value);
    }

    const existingInFlight = remoteSessionContextInFlight.get(cacheKey);
    if (existingInFlight) {
      return clonePayload(await existingInFlight);
    }
  }

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      return response.json() as Promise<RemoteSessionContextPayload>;
    } catch (error) {
      clearTimeout(timeoutId);
      logger.warn({ error, url }, 'Failed to fetch remote session context');
      return null;
    }
  })();

  if (cacheKey) {
    remoteSessionContextInFlight.set(cacheKey, fetchPromise);
  }

  try {
    const payload = await fetchPromise;
    if (cacheKey) {
      remoteSessionContextCache.set(cacheKey, {
        expiresAtMs: Date.now() + REMOTE_SESSION_CONTEXT_CACHE_TTL_MS,
        value: payload,
      });
    }
    return clonePayload(payload);
  } finally {
    if (cacheKey) {
      remoteSessionContextInFlight.delete(cacheKey);
    }
  }
}

export async function getRemoteSessionContext(c: Context): Promise<RemoteSessionContextPayload | null> {
  const secureSessionToken = getCookie(c, '__Secure-better-auth.session_token');
  const sessionToken = getCookie(c, 'better-auth.session_token');
  const token = secureSessionToken || sessionToken;
  const headers = new Headers();

  if (token) {
    const cookieName = secureSessionToken
      ? '__Secure-better-auth.session_token'
      : 'better-auth.session_token';
    headers.set('Cookie', `${cookieName}=${token}`);
  } else {
    const cookieHeader = c.req.header('Cookie');
    if (!cookieHeader) {
      return null;
    }
    headers.set('Cookie', cookieHeader);
  }

  headers.set('Content-Type', 'application/json');
  return getRemoteSessionContextFromAuthServer(headers);
}
