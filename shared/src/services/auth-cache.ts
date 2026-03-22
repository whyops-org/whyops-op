import env from '../config/env';
import type { SessionAuthContext } from '../middleware/types';
import { prefixedRedisKey, redisDeleteKeys, redisGetJson, redisSetJson } from './redis';

const CACHED_NULL = { __whyopsCachedNull: true } as const;
const singleActiveProviderMemoryCache = new Map<
  string,
  { expiresAtMs: number; hit: boolean; provider: unknown | null }
>();

function getSingleActiveProviderCacheKey(userId: string): string {
  return prefixedRedisKey('auth', 'provider', 'single-active', userId);
}

function getSessionAuthContextCacheKey(userId: string): string {
  return prefixedRedisKey('auth', 'session-context', userId);
}

export async function getCachedSingleActiveProvider<T>(
  userId: string
): Promise<{ hit: boolean; provider: T | null }> {
  const memoryCached = singleActiveProviderMemoryCache.get(userId);
  if (memoryCached && Date.now() <= memoryCached.expiresAtMs) {
    return { hit: memoryCached.hit, provider: (memoryCached.provider as T | null) ?? null };
  }

  if (memoryCached) {
    singleActiveProviderMemoryCache.delete(userId);
  }

  const raw = await redisGetJson<unknown>(getSingleActiveProviderCacheKey(userId));
  if (raw === null) {
    return { hit: false, provider: null };
  }

  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).__whyopsCachedNull === true) {
    singleActiveProviderMemoryCache.set(userId, {
      expiresAtMs: Date.now() + env.PROVIDER_CACHE_TTL_SEC * 1000,
      hit: true,
      provider: null,
    });
    return { hit: true, provider: null };
  }

  singleActiveProviderMemoryCache.set(userId, {
    expiresAtMs: Date.now() + env.PROVIDER_CACHE_TTL_SEC * 1000,
    hit: true,
    provider: raw,
  });

  return { hit: true, provider: raw as T };
}

export async function cacheSingleActiveProvider<T>(userId: string, provider: T | null): Promise<void> {
  singleActiveProviderMemoryCache.set(userId, {
    expiresAtMs: Date.now() + env.PROVIDER_CACHE_TTL_SEC * 1000,
    hit: true,
    provider,
  });

  await redisSetJson(
    getSingleActiveProviderCacheKey(userId),
    provider === null ? CACHED_NULL : provider,
    env.PROVIDER_CACHE_TTL_SEC
  );
}

export async function invalidateSingleActiveProviderCache(userId: string): Promise<void> {
  singleActiveProviderMemoryCache.delete(userId);
  await redisDeleteKeys(getSingleActiveProviderCacheKey(userId));
}

export async function getCachedSessionAuthContext(
  userId: string
): Promise<SessionAuthContext | null | undefined> {
  const raw = await redisGetJson<unknown>(getSessionAuthContextCacheKey(userId));
  if (raw === null) {
    return undefined;
  }

  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).__whyopsCachedNull === true) {
    return null;
  }

  return raw as SessionAuthContext;
}

export async function cacheSessionAuthContext(
  userId: string,
  context: SessionAuthContext | null
): Promise<void> {
  await redisSetJson(
    getSessionAuthContextCacheKey(userId),
    context ?? CACHED_NULL,
    Math.max(1, Math.ceil(env.AUTH_SESSION_AUTH_CONTEXT_CACHE_TTL_MS / 1000))
  );
}

export async function invalidateSessionAuthContext(userId: string): Promise<void> {
  await redisDeleteKeys(getSessionAuthContextCacheKey(userId));
}
