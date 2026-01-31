import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createServiceLogger } from '@whyops/shared/logger';
import { ApiKey, Provider } from '@whyops/shared/models';
import { generateApiKey, hashApiKey } from '@whyops/shared/utils';
import env from '@whyops/shared/env';

const logger = createServiceLogger('auth:apikeys');
const app = new Hono();

// API Key schema
const apiKeySchema = z.object({
  providerId: z.string().uuid(),
  name: z.string().min(1),
  rateLimit: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET /api/api-keys - List all API keys for user
app.get('/', async (c) => {
  const user = c.get('user');

  try {
    const apiKeys = await ApiKey.findAll({
      where: { userId: user.userId },
      include: [
        {
          model: Provider,
          as: 'provider',
          attributes: ['id', 'name', 'type'],
        },
      ],
      attributes: { exclude: ['keyHash'] }, // Don't return hash
    });

    return c.json({ apiKeys });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch API keys');
    return c.json({ error: 'Failed to fetch API keys' }, 500);
  }
});

// POST /api/api-keys - Create new API key
app.post('/', zValidator('json', apiKeySchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  try {
    // Verify provider belongs to user
    const provider = await Provider.findOne({
      where: { id: data.providerId, userId: user.userId },
    });

    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    // Generate API key
    const apiKey = generateApiKey(env.API_KEY_PREFIX);
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12);

    // Create API key record
    const apiKeyRecord = await ApiKey.create({
      userId: user.userId,
      providerId: data.providerId,
      name: data.name,
      keyHash,
      keyPrefix,
      rateLimit: data.rateLimit,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      metadata: data.metadata,
      isActive: true,
    });

    logger.info({ apiKeyId: apiKeyRecord.id, userId: user.userId, providerId: data.providerId }, 'API key created');

    // Return the full key only once (can't retrieve it again)
    return c.json({
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      apiKey, // Only returned on creation
      keyPrefix,
      providerId: apiKeyRecord.providerId,
      rateLimit: apiKeyRecord.rateLimit,
      expiresAt: apiKeyRecord.expiresAt,
      isActive: apiKeyRecord.isActive,
      createdAt: apiKeyRecord.createdAt,
      warning: 'Save this API key securely. You will not be able to retrieve it again.',
    }, 201);
  } catch (error: any) {
    logger.error({ error }, 'Failed to create API key');
    return c.json({ error: 'Failed to create API key' }, 500);
  }
});

// GET /api/api-keys/:id - Get single API key
app.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const apiKey = await ApiKey.findOne({
      where: { id, userId: user.userId },
      include: [
        {
          model: Provider,
          as: 'provider',
          attributes: ['id', 'name', 'type'],
        },
      ],
      attributes: { exclude: ['keyHash'] },
    });

    if (!apiKey) {
      return c.json({ error: 'API key not found' }, 404);
    }

    return c.json(apiKey);
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch API key');
    return c.json({ error: 'Failed to fetch API key' }, 500);
  }
});

// PUT /api/api-keys/:id - Update API key metadata
app.put('/:id', zValidator('json', z.object({
  name: z.string().min(1).optional(),
  rateLimit: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
})), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const apiKey = await ApiKey.findOne({
      where: { id, userId: user.userId },
    });

    if (!apiKey) {
      return c.json({ error: 'API key not found' }, 404);
    }

    // Update fields
    if (data.name) apiKey.name = data.name;
    if (data.rateLimit !== undefined) apiKey.rateLimit = data.rateLimit;
    if (data.expiresAt) apiKey.expiresAt = new Date(data.expiresAt);
    if (data.metadata) apiKey.metadata = data.metadata;

    await apiKey.save();

    logger.info({ apiKeyId: id }, 'API key updated');

    return c.json({
      id: apiKey.id,
      name: apiKey.name,
      rateLimit: apiKey.rateLimit,
      expiresAt: apiKey.expiresAt,
      updatedAt: apiKey.updatedAt,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to update API key');
    return c.json({ error: 'Failed to update API key' }, 500);
  }
});

// DELETE /api/api-keys/:id - Delete/revoke API key
app.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const apiKey = await ApiKey.findOne({
      where: { id, userId: user.userId },
    });

    if (!apiKey) {
      return c.json({ error: 'API key not found' }, 404);
    }

    await apiKey.destroy();

    logger.info({ apiKeyId: id }, 'API key deleted');

    return c.json({ message: 'API key revoked' });
  } catch (error: any) {
    logger.error({ error }, 'Failed to delete API key');
    return c.json({ error: 'Failed to delete API key' }, 500);
  }
});

// PATCH /api/api-keys/:id/toggle - Toggle API key active status
app.patch('/:id/toggle', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const apiKey = await ApiKey.findOne({
      where: { id, userId: user.userId },
    });

    if (!apiKey) {
      return c.json({ error: 'API key not found' }, 404);
    }

    apiKey.isActive = !apiKey.isActive;
    await apiKey.save();

    logger.info({ apiKeyId: id, isActive: apiKey.isActive }, 'API key toggled');

    return c.json({ isActive: apiKey.isActive });
  } catch (error: any) {
    logger.error({ error }, 'Failed to toggle API key');
    return c.json({ error: 'Failed to toggle API key' }, 500);
  }
});

export default app;
