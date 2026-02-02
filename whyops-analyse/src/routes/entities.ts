import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createServiceLogger } from '@whyops/shared/logger';
import { Entity } from '@whyops/shared/models';
import CryptoJS from 'crypto-js';

const logger = createServiceLogger('analyse:entities');
const app = new Hono();

const entityInitSchema = z.object({
  name: z.string().min(1, "Entity name is required"),
  userId: z.string().uuid("Invalid User ID"),
  metadata: z.record(z.any()).optional().default({}), // tools, system prompt, etc.
});

app.post('/init', zValidator('json', entityInitSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    // 1. Generate Hash of Metadata (deterministic)
    // We sort keys to ensure consistency
    const hashPayload = {
      metadata: data.metadata,
      name: data.name // Include name in hash? Requirement says "check old and new with hash", usually implies content. 
                      // But since names are unique per user effectively for identity, versions are distinguished by hash.
                      // Let's hash the content (metadata) primarily.
    };
    const rawString = JSON.stringify(hashPayload, Object.keys(hashPayload).sort());
    const newHash = CryptoJS.SHA256(rawString).toString();

    // 2. Check for existing entity with this name for this user
    // We want to see if the LATEST version of this entity has the same hash.
    const lastEntity = await Entity.findOne({
      where: {
        userId: data.userId,
        name: data.name,
      },
      order: [['createdAt', 'DESC']],
    });

    if (lastEntity && lastEntity.hash === newHash) {
      // Hash matches, return existing ID
      logger.info({ entityId: lastEntity.id, name: data.name }, 'Entity init: Match found, returning existing');
      return c.json({ id: lastEntity.id, status: 'existing', version: lastEntity.hash });
    }

    // 3. Create new entity version (Name reused, but new record due to hash mismatch or first time)
    // Requirement: "each user the entityName cannot be used again using again means the request will be mapped to the old agent only"
    // Clarification: "if chaged we make a new entry in the array else keep the same"
    // This implies versioning. We create a NEW Entity record with the same name but different hash/ID.
    
    const newEntity = await Entity.create({
      userId: data.userId,
      name: data.name,
      hash: newHash,
      metadata: data.metadata,
      id: crypto.randomUUID(), // Assuming native UUID or import uuid
    } as any);

    logger.info({ entityId: newEntity.id, name: data.name }, 'Entity init: Created new version');
    return c.json({ id: newEntity.id, status: 'created', version: newHash }, 201);

  } catch (error: any) {
    logger.error({ error, data }, 'Failed to init entity');
    return c.json({ error: 'Failed to initialize entity' }, 500);
  }
});

// GET /api/entities/:id
app.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const entity = await Entity.findByPk(id);
        if (!entity) return c.json({ error: 'Entity not found' }, 404);
        return c.json(entity);
    } catch (e) {
        return c.json({ error: 'Internal Error' }, 500);
    }
});

export default app;
