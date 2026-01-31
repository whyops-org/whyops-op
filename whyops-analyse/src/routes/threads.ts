import { createServiceLogger } from '@whyops/shared/logger';
import { LLMEvent } from '@whyops/shared/models';
import { Hono } from 'hono';

const logger = createServiceLogger('analyse:threads');
const app = new Hono();

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
        'threadId',
        'userId',
        'providerId',
        [LLMEvent.sequelize!.fn('MAX', LLMEvent.sequelize!.col('timestamp')), 'lastActivity'],
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.col('id')), 'eventCount'],
      ],
      where,
      group: ['threadId', 'userId', 'providerId'],
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
      where: { threadId },
      order: [['stepId', 'ASC'], ['timestamp', 'ASC']],
    });

    if (events.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    // Calculate thread statistics
    const totalTokens = events.reduce((sum, e) => sum + (e.usage?.totalTokens || 0), 0);
    const totalLatency = events.reduce((sum, e) => sum + (e.latencyMs || 0), 0);
    const errorCount = events.filter(e => e.error).length;

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
      where: { threadId },
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
      model: e.model,
      timestamp: e.timestamp,
      latencyMs: e.latencyMs,
      hasError: !!e.error,
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
