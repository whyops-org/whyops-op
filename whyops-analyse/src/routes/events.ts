import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createServiceLogger } from '@whyops/shared/logger';
import { LLMEvent } from '@whyops/shared/models';

const logger = createServiceLogger('analyse:events');
const app = new Hono();

// Event schema
const eventSchema = z.object({
  eventType: z.enum(['llm_call', 'tool_execution', 'memory_retrieval', 'planner_step', 'agent_termination']),
  threadId: z.string(),
  spanId: z.string().optional(),
  stepId: z.number().optional(),
  parentStepId: z.number().optional(),
  userId: z.string().uuid(),
  providerId: z.string().uuid(),
  provider: z.enum(['openai', 'anthropic']),
  model: z.string(),
  systemPrompt: z.string().optional(),
  messages: z.array(z.any()).optional(),
  tools: z.array(z.any()).optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  response: z.object({
    content: z.string().optional(),
    toolCalls: z.array(z.any()).optional(),
    finishReason: z.string().optional(),
  }).optional(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

// POST /api/events - Create a new event
app.post('/', zValidator('json', eventSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    // For MVP, we only handle llm_call events
    if (data.eventType === 'llm_call') {
      const event = await LLMEvent.create({
        eventType: 'llm_call',
        threadId: data.threadId,
        stepId: data.stepId || 1,
        parentStepId: data.parentStepId,
        spanId: data.spanId,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        metadata: data.metadata,
        userId: data.userId,
        providerId: data.providerId,
        provider: data.provider,
        model: data.model,
        systemPrompt: data.systemPrompt,
        messages: data.messages || [],
        tools: data.tools,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        response: data.response,
        usage: data.usage,
        latencyMs: data.latencyMs,
        error: data.error,
      });

      logger.info({
        eventId: event.id,
        threadId: data.threadId,
        provider: data.provider,
        model: data.model,
      }, 'Event saved');

      return c.json({ id: event.id, status: 'saved' }, 201);
    }

    // For other event types, just acknowledge (will implement later)
    logger.info({ eventType: data.eventType }, 'Event type not yet implemented');
    return c.json({ status: 'acknowledged' }, 202);
    
  } catch (error: any) {
    logger.error({ error, data }, 'Failed to save event');
    return c.json({ error: 'Failed to save event' }, 500);
  }
});

// GET /api/events - List events (with filters)
app.get('/', async (c) => {
  try {
    const threadId = c.req.query('threadId');
    const userId = c.req.query('userId');
    const providerId = c.req.query('providerId');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    const where: any = {};
    if (threadId) where.threadId = threadId;
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
