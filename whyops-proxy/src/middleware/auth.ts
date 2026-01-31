import type { Context, Next } from 'hono';
import { createServiceLogger } from '@whyops/shared/logger';
import { ApiKey, Provider } from '@whyops/shared/models';
import { hashApiKey, validateApiKeyFormat } from '@whyops/shared/utils';

const logger = createServiceLogger('proxy:auth');

export interface AuthContext {
  userId: string;
  apiKeyId: string;
  providerId: string;
  provider: any;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header');
    return c.json({ error: 'Unauthorized: Missing API key' }, 401);
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer '

  // Validate format
  if (!validateApiKeyFormat(apiKey)) {
    logger.warn({ apiKey: apiKey.substring(0, 12) + '...' }, 'Invalid API key format');
    return c.json({ error: 'Unauthorized: Invalid API key format' }, 401);
  }

  try {
    // Hash and lookup
    const keyHash = hashApiKey(apiKey);
    
    const apiKeyRecord = await ApiKey.findOne({
      where: {
        keyHash,
        isActive: true,
      },
      include: [
        {
          model: Provider,
          as: 'provider',
          required: true,
        },
      ],
    });

    if (!apiKeyRecord) {
      logger.warn({ keyHash: keyHash.substring(0, 16) + '...' }, 'API key not found');
      return c.json({ error: 'Unauthorized: Invalid API key' }, 401);
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      logger.warn({ apiKeyId: apiKeyRecord.id }, 'API key expired');
      return c.json({ error: 'Unauthorized: API key expired' }, 401);
    }

    // Update last used (fire and forget)
    ApiKey.update(
      { lastUsedAt: new Date() },
      { where: { id: apiKeyRecord.id } }
    ).catch((err) => logger.error({ err }, 'Failed to update lastUsedAt'));

    // Set auth context
    c.set('auth', {
      userId: apiKeyRecord.userId,
      apiKeyId: apiKeyRecord.id,
      providerId: apiKeyRecord.providerId,
      provider: (apiKeyRecord as any).provider,
    });

    await next();
  } catch (error) {
    logger.error({ error }, 'Auth middleware error');
    return c.json({ error: 'Internal server error' }, 500);
  }
}
