import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createServiceLogger } from '@whyops/shared/logger';
import { LLMEvent } from '@whyops/shared/models';
import { nanoid } from 'nanoid';

const logger = createServiceLogger('analyse:events');
const app = new Hono();

// Event schema (Updated)
const eventSchema = z.object({
  eventType: z.enum(['user_message', 'llm_response', 'tool_call', 'error']),
  traceId: z.string(),
  spanId: z.string().optional(),
  stepId: z.number().optional(),
  parentStepId: z.number().optional(),
  userId: z.string().uuid(),
  providerId: z.string().uuid(),
  timestamp: z.string().datetime().optional(),
  content: z.any().optional(), // Flexible JSON payload
  metadata: z.record(z.any()).optional(),
});

// POST /api/events - Create a new event
app.post('/', zValidator('json', eventSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    // Auto-resolve stepId and parentStepId if not provided
    let stepId = data.stepId;
    let parentStepId = data.parentStepId;
    
    // Auto-generate spanId if not provided
    const spanId = data.spanId || `span_${nanoid()}`;

    if (!stepId) {
      // Find the last event in this trace/thread
      const lastEvent = await LLMEvent.findOne({
        where: { traceId: data.traceId },
        order: [['stepId', 'DESC']],
        attributes: ['stepId']
      });

      if (lastEvent) {
        stepId = lastEvent.stepId + 1;
        // In a linear chain, the parent is the immediately preceding step
        parentStepId = lastEvent.stepId;
      } else {
        // First event in trace
        stepId = 1;
        parentStepId = undefined; // No parent for root
      }
    }

    const event = await LLMEvent.create({
      eventType: data.eventType,
      traceId: data.traceId,
      stepId: stepId,
      parentStepId: parentStepId,
      spanId: spanId,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      content: data.content,
      metadata: data.metadata,
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

    return c.json({ id: event.id, status: 'saved', stepId, parentStepId, spanId }, 201);
    
  } catch (error: any) {
    logger.error({ error, data }, 'Failed to save event');
    return c.json({ error: 'Failed to save event' }, 500);
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
