import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createServiceLogger } from '@whyops/shared/logger';
import { LLMEvent, Trace, Provider, Entity } from '@whyops/shared/models';
import { nanoid } from 'nanoid';
import { Op } from 'sequelize';
import { traceQueue } from '../utils/queue';
import CryptoJS from 'crypto-js';
import { ParserFactory } from '../parsers';

const logger = createServiceLogger('analyse:events');
const app = new Hono();

// ... existing schema ...
const eventSchema = z.object({
  eventType: z.enum(['user_message', 'llm_response', 'tool_call', 'error'], {
    errorMap: () => ({ message: "Invalid event type. Must be one of: 'user_message', 'llm_response', 'tool_call', 'error'" }),
  }),
  traceId: z.string().min(1).max(128, "Trace ID must be between 1 and 128 characters"),
  spanId: z.string().max(128, "Span ID must be at most 128 characters").optional(),
  stepId: z.number().int().min(1, "Step ID must be a positive integer").optional(),
  parentStepId: z.number().int().min(1, "Parent Step ID must be a positive integer").optional(),
  userId: z.string().uuid("Invalid User ID format (UUID required)"),
  providerId: z.string().uuid("Invalid Provider ID format (UUID required)"),
  entityName: z.string().optional(), // New field for entity resolution
  timestamp: z.string().datetime({ message: "Invalid timestamp format (ISO 8601 required)" }).optional(),
  content: z.any().optional(), // Flexible JSON payload
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string().max(128, "Idempotency Key must be at most 128 characters").optional(),
});

type EventData = z.infer<typeof eventSchema>;

const batchEventSchema = z.union([eventSchema, z.array(eventSchema)]);

function generateContentHash(data: EventData): string {
  // ... existing hash logic ...
  const payload = {
    traceId: data.traceId,
    eventType: data.eventType,
    userId: data.userId,
    parentStepId: data.parentStepId,
    content: data.content, 
  };
  const rawString = JSON.stringify(payload);
  return CryptoJS.SHA256(rawString).toString();
}

async function resolveEntityId(userId: string, entityName?: string): Promise<string | undefined> {
  if (!entityName) return undefined;
  
  // Find the LATEST version of the entity for this user/name
  const entity = await Entity.findOne({
    where: { userId, name: entityName },
    order: [['createdAt', 'DESC']],
  });
  
  return entity?.id;
}

async function ensureTraceExists(data: EventData) {
  try {
    // 1. Check if trace exists first (fast path)
    let trace = await Trace.findByPk(data.traceId);
    if (trace) {
        // Trace already exists, it is already locked to an Entity Version (if any).
        // We do NOT update entityId here to ensure consistency (no version jumping mid-trace).
        return;
    }

    // 2. Resolve Entity ID (if name provided)
    // This happens ONLY once at trace creation
    let resolvedEntityId: string | undefined;
    if (data.entityName) {
        resolvedEntityId = await resolveEntityId(data.userId, data.entityName);
    }

    // 3. Resolve Provider Type to select parser
    let providerType = 'openai'; // default
    try {
      const provider = await Provider.findByPk(data.providerId);
      if (provider) providerType = provider.type;
    } catch (e) {
      logger.warn({ providerId: data.providerId }, 'Failed to fetch provider type for trace init, using default');
    }

    // 4. Extract Metadata using Strategy Pattern
    // Note: If we have an Entity, we technically have the metadata there.
    // However, saving "snapshot" metadata to the Trace is still useful for standalone analysis
    // or if the event has specific overrides (like model parameters).
    const parser = ParserFactory.getParser(providerType);
    const metadata = parser.extract(data.content, data.metadata);

    // 5. Create Trace (using findOrCreate for safety)
    const [newTrace, created] = await Trace.findOrCreate({
      where: { id: data.traceId },
      defaults: {
        id: data.traceId,
        userId: data.userId,
        providerId: data.providerId,
        entityId: resolvedEntityId, // Link to resolved Entity Version
        model: metadata.model,
        systemMessage: metadata.systemMessage,
        tools: metadata.tools,
        metadata: data.metadata,
        createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
      }
    });

    if (created) {
      logger.info({ traceId: newTrace.id, providerType, entityId: resolvedEntityId }, 'Trace initialized automatically');
    }
  } catch (error) {
    logger.error({ error, traceId: data.traceId }, 'Failed to ensure trace existence');
  }
}

async function processEvent(data: EventData) {
  // Wrap the critical section (find last step + create) in a per-trace queue
  return traceQueue.getQueue(data.traceId).add(async () => {
    
    // 0. Ensure Trace Exists (Metadata Initialization & Entity Resolution)
    await ensureTraceExists(data);

    // 1. Idempotency Check (Hash-based)
    const idempotencyKey = data.idempotencyKey || `hash_${generateContentHash(data)}`;

    const existingEvent = await LLMEvent.findOne({
      where: {
        traceId: data.traceId,
        metadata: {
          [Op.contains]: { idempotencyKey: idempotencyKey }
        }
      } as any
    });

    if (existingEvent) {
       // ... existing duplicate handling ...
       logger.info({
        traceId: data.traceId,
        idempotencyKey: idempotencyKey,
        existingEventId: existingEvent.id
      }, 'Idempotent duplicate detected (content hash), skipping creation');
      
      return {
        id: existingEvent.id,
        status: 'skipped', 
        stepId: existingEvent.stepId,
        parentStepId: existingEvent.parentStepId,
        spanId: existingEvent.spanId,
        message: 'Event already exists (idempotency check)'
      };
    }

    // ... existing step resolution ...
    let stepId = data.stepId;
    let parentStepId = data.parentStepId;
    const spanId = data.spanId || `span_${nanoid()}`;

    if (!stepId) {
      const lastEvent = await LLMEvent.findOne({
        where: { traceId: data.traceId },
        order: [['stepId', 'DESC']],
      });

      if (lastEvent) {
        stepId = lastEvent.stepId + 1;
        parentStepId = lastEvent.stepId;
      } else {
        stepId = 1;
        parentStepId = undefined;
      }
    } else if (!parentStepId && stepId > 1) {
       parentStepId = stepId - 1;
    }

    // Prepare metadata with idempotencyKey
    const finalMetadata = {
      ...(data.metadata || {}),
      idempotencyKey: idempotencyKey
    };

    const event = await LLMEvent.create({
      eventType: data.eventType,
      traceId: data.traceId,
      stepId: stepId,
      parentStepId: parentStepId,
      spanId: spanId,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      content: data.content,
      metadata: finalMetadata,
      userId: data.userId,
      providerId: data.providerId,
    });

    logger.info({
      eventId: event.id,
      traceId: data.traceId,
      stepId,
      eventType: data.eventType,
      spanId,
    }, 'Event saved');

    return { id: event.id, status: 'saved', stepId, parentStepId, spanId };
  });
}

// POST /api/events - Create a new event (or batch of events)
app.post('/', zValidator('json', batchEventSchema, (result, c) => {
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code
    }));
    logger.warn({ errors }, 'Event validation failed');
    return c.json({ error: 'Validation failed', details: errors }, 400);
  }
}), async (c) => {
  const data = c.req.valid('json');

  try {
    if (Array.isArray(data)) {
      const results = await Promise.all(data.map(item => processEvent(item)));
      return c.json(results, 201);
    } else {
      const result = await processEvent(data);
      return c.json(result, 201);
    }
  } catch (error: any) {
    logger.error({ error, data }, 'Failed to save event(s)');
    return c.json({ error: 'Failed to save event(s)' }, 500);
  }
});

// GET /api/events - List events (with filters)
app.get('/', async (c) => {
  try {
    const traceId = c.req.query('traceId') || c.req.query('threadId'); // Support both params
    const userId = c.req.query('userId');
    const providerId = c.req.query('providerId');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    const where: any = {};
    if (traceId) where.traceId = traceId;
    if (userId) where.userId = userId;
    if (providerId) where.providerId = providerId;

    const events = await LLMEvent.findAll({
      where,
      limit,
      offset,
      order: [['timestamp', 'DESC']],
    });

    const total = await LLMEvent.count({ where });

    return c.json({
      events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch events');
    return c.json({ error: 'Failed to fetch events' }, 500);
  }
});


// GET /api/events/:id - Get single event
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const event = await LLMEvent.findByPk(id);

    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    return c.json(event);
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch event');
    return c.json({ error: 'Failed to fetch event' }, 500);
  }
});

export default app;
