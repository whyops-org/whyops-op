import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createServiceLogger } from '@whyops/shared/logger';
import { Provider } from '@whyops/shared/models';
import crypto from 'crypto';

const logger = createServiceLogger('auth:providers');
const app = new Hono();

// Provider schema
const providerSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['openai', 'anthropic']),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

// Encrypt API key (simple encryption - for production use proper encryption)
function encryptApiKey(apiKey: string): string {
  // In production, use a proper encryption library like crypto-js or node's crypto with AES
  // For now, just base64 encode (NOT SECURE - just for MVP)
  return Buffer.from(apiKey).toString('base64');
}

// Decrypt API key
function decryptApiKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

// GET /api/providers - List all providers for user
app.get('/', async (c) => {
  const user = c.get('user');

  try {
    const providers = await Provider.findAll({
      where: { userId: user.userId },
      attributes: { exclude: ['apiKey'] }, // Don't return API keys
    });

    return c.json({ providers });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch providers');
    return c.json({ error: 'Failed to fetch providers' }, 500);
  }
});

// POST /api/providers - Create new provider
app.post('/', zValidator('json', providerSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  try {
    const provider = await Provider.create({
      userId: user.userId,
      name: data.name,
      type: data.type,
      baseUrl: data.baseUrl,
      apiKey: encryptApiKey(data.apiKey), // Encrypt before storing
      metadata: data.metadata,
      isActive: true,
    });

    logger.info({ providerId: provider.id, userId: user.userId, type: data.type }, 'Provider created');

    return c.json({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      isActive: provider.isActive,
      createdAt: provider.createdAt,
    }, 201);
  } catch (error: any) {
    logger.error({ error }, 'Failed to create provider');
    return c.json({ error: 'Failed to create provider' }, 500);
  }
});

// GET /api/providers/:id - Get single provider
app.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const provider = await Provider.findOne({
      where: { id, userId: user.userId },
      attributes: { exclude: ['apiKey'] },
    });

    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    return c.json(provider);
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch provider');
    return c.json({ error: 'Failed to fetch provider' }, 500);
  }
});

// PUT /api/providers/:id - Update provider
app.put('/:id', zValidator('json', providerSchema.partial()), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const provider = await Provider.findOne({
      where: { id, userId: user.userId },
    });

    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    // Update fields
    if (data.name) provider.name = data.name;
    if (data.type) provider.type = data.type;
    if (data.baseUrl) provider.baseUrl = data.baseUrl;
    if (data.apiKey) provider.apiKey = encryptApiKey(data.apiKey);
    if (data.metadata) provider.metadata = data.metadata;

    await provider.save();

    logger.info({ providerId: provider.id }, 'Provider updated');

    return c.json({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      isActive: provider.isActive,
      updatedAt: provider.updatedAt,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to update provider');
    return c.json({ error: 'Failed to update provider' }, 500);
  }
});

// DELETE /api/providers/:id - Delete provider
app.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const provider = await Provider.findOne({
      where: { id, userId: user.userId },
    });

    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    await provider.destroy();

    logger.info({ providerId: id }, 'Provider deleted');

    return c.json({ message: 'Provider deleted' });
  } catch (error: any) {
    logger.error({ error }, 'Failed to delete provider');
    return c.json({ error: 'Failed to delete provider' }, 500);
  }
});

// PATCH /api/providers/:id/toggle - Toggle provider active status
app.patch('/:id/toggle', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const provider = await Provider.findOne({
      where: { id, userId: user.userId },
    });

    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    provider.isActive = !provider.isActive;
    await provider.save();

    logger.info({ providerId: id, isActive: provider.isActive }, 'Provider toggled');

    return c.json({ isActive: provider.isActive });
  } catch (error: any) {
    logger.error({ error }, 'Failed to toggle provider');
    return c.json({ error: 'Failed to toggle provider' }, 500);
  }
});

export default app;
