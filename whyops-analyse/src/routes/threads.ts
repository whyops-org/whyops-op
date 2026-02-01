import { createServiceLogger } from '@whyops/shared/logger';
import { LLMEvent } from '@whyops/shared/models';
import { Hono } from 'hono';
import { Op } from 'sequelize';

const logger = createServiceLogger('analyse:threads');
const app = new Hono();

// POST /api/threads/match - Match request history to an existing thread
app.post('/match', async (c) => {
  const { messages, providerId } = await c.req.json();

  if (!messages || !Array.isArray(messages) || messages.length < 2) {
    return c.json({ found: false, reason: 'Insufficient history' });
  }

  let anchorMessage = null;
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      anchorMessage = messages[i];
      break;
    }
  }

  if (!anchorMessage || !anchorMessage.content) {
    return c.json({ found: false, reason: 'No anchor message found' });
  }

  try {
    const matchedEvent = await LLMEvent.findOne({
      where: {
        providerId, 
        eventType: 'llm_response',
        content: {
          [Op.contains]: { content: anchorMessage.content }
        }
      },
      order: [['timestamp', 'DESC']], 
    });

    if (matchedEvent) {
      return c.json({ 
        found: true, 
        traceId: matchedEvent.traceId,
        matchEventId: matchedEvent.id 
      });
    }

    return c.json({ found: false });

  } catch (error: any) {
    logger.error({ error }, 'Failed to match thread');
    return c.json({ error: 'Failed to match thread' }, 500);
  }
});

// GET /api/threads - List all threads
app.get('/', async (c) => {
  try {
    const userId = c.req.query('userId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const where: any = {};
    if (userId) where.userId = userId;

    // Get unique threads with their latest event
    const threads = await LLMEvent.findAll({
      attributes: [
        ['trace_id', 'threadId'], // Rename for API compat
        ['user_id', 'userId'],
        ['provider_id', 'providerId'],
        [LLMEvent.sequelize!.fn('MAX', LLMEvent.sequelize!.col('timestamp')), 'lastActivity'],
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.col('id')), 'eventCount'],
      ],
      where,
      group: ['trace_id', 'user_id', 'provider_id'],
      order: [[LLMEvent.sequelize!.fn('MAX', LLMEvent.sequelize!.col('timestamp')), 'DESC']],
      limit,
      offset,
      raw: true,
    });

    return c.json({ threads });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch threads');
    return c.json({ error: 'Failed to fetch threads' }, 500);
  }
});

// GET /api/threads/:threadId - Get thread details with all events
app.get('/:threadId', async (c) => {
  try {
    const threadId = c.req.param('threadId');

    const events = await LLMEvent.findAll({
      where: { traceId: threadId },
      order: [['stepId', 'ASC'], ['timestamp', 'ASC']],
    });

    if (events.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    // Calculate thread statistics based on generic content
    const totalTokens = events.reduce((sum, e) => {
      const usage = e.metadata?.usage || e.content?.usage; // Access from JSONB
      return sum + (usage?.totalTokens || 0);
    }, 0);
    
    // Access latency from metadata
    const totalLatency = events.reduce((sum, e) => sum + (e.metadata?.latencyMs || 0), 0);
    const errorCount = events.filter(e => e.eventType === 'error').length;

    return c.json({
      threadId,
      userId: events[0].userId,
      providerId: events[0].providerId,
      eventCount: events.length,
      firstEvent: events[0].timestamp,
      lastEvent: events[events.length - 1].timestamp,
      statistics: {
        totalTokens,
        totalLatency,
        avgLatency: totalLatency / events.length,
        errorCount,
      },
      events,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch thread');
    return c.json({ error: 'Failed to fetch thread' }, 500);
  }
});

// GET /api/threads/:threadId/graph - Get decision graph for thread
app.get('/:threadId/graph', async (c) => {
  try {
    const threadId = c.req.param('threadId');

    const events = await LLMEvent.findAll({
      where: { traceId: threadId },
      order: [['stepId', 'ASC'], ['timestamp', 'ASC']],
    });

    if (events.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    // Build decision graph (simple DAG representation)
    const nodes = events.map(e => ({
      id: e.id,
      stepId: e.stepId,
      parentStepId: e.parentStepId,
      type: e.eventType,
      model: e.metadata?.model, // Access from metadata
      timestamp: e.timestamp,
      latencyMs: e.metadata?.latencyMs, // Access from metadata
      hasError: e.eventType === 'error',
    }));

    const edges = events
      .filter(e => e.parentStepId)
      .map(e => ({
        from: events.find(parent => parent.stepId === e.parentStepId)?.id,
        to: e.id,
      }))
      .filter(edge => edge.from);

    return c.json({
      threadId,
      graph: {
        nodes,
        edges,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to build graph');
    return c.json({ error: 'Failed to build graph' }, 500);
  }
});

export default app;
