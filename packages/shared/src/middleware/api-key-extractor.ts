import type { Context } from 'hono';
import type { ApiKeyExtractor, ApiKeyExtractorConfig } from './types';

const defaultExtractors: ApiKeyExtractorConfig[] = [
  {
    name: 'bearer',
    priority: 100,
    extractor: (c: Context) => {
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
      }
      return undefined;
    },
  },
  {
    name: 'x-api-key',
    priority: 90,
    extractor: (c: Context) => {
      return c.req.header('X-API-Key') ?? c.req.header('x-api-key');
    },
  },
];

const customExtractors: ApiKeyExtractorConfig[] = [];

export function registerApiKeyExtractor(config: ApiKeyExtractorConfig): void {
  customExtractors.push(config);
  customExtractors.sort((a, b) => b.priority - a.priority);
}

export function clearCustomExtractors(): void {
  customExtractors.length = 0;
}

export async function extractApiKey(c: Context): Promise<string | undefined> {
  const allExtractors = [...customExtractors, ...defaultExtractors].sort(
    (a, b) => b.priority - a.priority
  );

  for (const { extractor } of allExtractors) {
    const result = await extractor(c);
    if (result) {
      return result;
    }
  }

  return undefined;
}

export function createHeaderExtractor(headerName: string): ApiKeyExtractor {
  return (c: Context) => {
    const value = c.req.header(headerName) ?? c.req.header(headerName.toLowerCase());
    return value?.trim();
  };
}

export function createBearerTokenExtractor(): ApiKeyExtractor {
  return (c: Context) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return undefined;
  };
}

export function createQueryExtractor(paramName: string = 'api_key'): ApiKeyExtractor {
  return (c: Context) => {
    return c.req.query(paramName);
  };
}

export function createCookieExtractor(cookieName: string): ApiKeyExtractor {
  return async (c: Context) => {
    const { getCookie } = await import('hono/cookie');
    return getCookie(c, cookieName);
  };
}
