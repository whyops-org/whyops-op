import { createServiceLogger } from '@whyops/shared/logger';
import { LLMEvent } from '@whyops/shared/models';
import { Hono } from 'hono';
import { Op } from 'sequelize';

const logger = createServiceLogger('analyse:analytics');
const app = new Hono();

// GET /api/analytics/usage - Get usage statistics
app.get('/usage', async (c) => {
  try {
    const userId = c.req.query('userId');
    const providerId = c.req.query('providerId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const where: any = {};
    if (userId) where.userId = userId;
    if (providerId) where.providerId = providerId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[Op.gte] = new Date(startDate);
      if (endDate) where.timestamp[Op.lte] = new Date(endDate);
    }

    const stats = await LLMEvent.findAll({
      attributes: [
        'provider',
        'model',
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.col('id')), 'requestCount'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal("(usage->>'totalTokens')::int")), 'totalTokens'],
        [LLMEvent.sequelize!.fn('AVG', LLMEvent.sequelize!.col('latency_ms')), 'avgLatency'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal('CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END')), 'errorCount'],
      ],
      where,
      group: ['provider', 'model'],
      raw: true,
    });

    return c.json({ stats });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch analytics');
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

// GET /api/analytics/timeline - Get timeline data
app.get('/timeline', async (c) => {
  try {
    const userId = c.req.query('userId');
    const providerId = c.req.query('providerId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const interval = c.req.query('interval') || 'hour'; // hour, day, week

    const where: any = {};
    if (userId) where.userId = userId;
    if (providerId) where.providerId = providerId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[Op.gte] = new Date(startDate);
      if (endDate) where.timestamp[Op.lte] = new Date(endDate);
    }

    // Determine date truncation based on interval
    let dateTrunc = "date_trunc('hour', timestamp)";
    if (interval === 'day') {
      dateTrunc = "date_trunc('day', timestamp)";
    } else if (interval === 'week') {
      dateTrunc = "date_trunc('week', timestamp)";
    }

    const timeline = await LLMEvent.findAll({
      attributes: [
        [LLMEvent.sequelize!.literal(dateTrunc), 'interval'],
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.col('id')), 'requestCount'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal("(usage->>'totalTokens')::int")), 'totalTokens'],
      ],
      where,
      group: ['interval'],
      order: [[LLMEvent.sequelize!.literal(dateTrunc), 'ASC']],
      raw: true,
    });

    return c.json({ timeline });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch timeline');
    return c.json({ error: 'Failed to fetch timeline' }, 500);
  }
});

// GET /api/analytics/summary - Get high-level summary
app.get('/summary', async (c) => {
  try {
    const userId = c.req.query('userId');
    const providerId = c.req.query('providerId');

    const where: any = {};
    if (userId) where.userId = userId;
    if (providerId) where.providerId = providerId;

    const summary = await LLMEvent.findOne({
      attributes: [
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.col('id')), 'totalRequests'],
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.fn('DISTINCT', LLMEvent.sequelize!.col('thread_id'))), 'totalThreads'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal("(usage->>'totalTokens')::int")), 'totalTokens'],
        [LLMEvent.sequelize!.fn('AVG', LLMEvent.sequelize!.col('latency_ms')), 'avgLatency'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal('CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END')), 'errorCount'],
      ],
      where,
      raw: true,
    });

    return c.json({ summary });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch summary');
    return c.json({ error: 'Failed to fetch summary' }, 500);
  }
});

export default app;
