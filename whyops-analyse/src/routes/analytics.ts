import { createServiceLogger } from '@whyops/shared/logger';
import { Agent, LLMEvent, Trace } from '@whyops/shared/models';
import { Hono } from 'hono';
import { Op, QueryTypes } from 'sequelize';

const logger = createServiceLogger('analyse:analytics');
const app = new Hono();

interface DashboardDailySuccessRow {
  day: string;
  totalEvents: string | number;
  errorEvents: string | number;
}

interface DashboardPeriodStatsRow {
  totalEvents: string | number;
  errorEvents: string | number;
  avgLatency: string | number | null;
}

const providerExpr = `COALESCE(NULLIF("metadata"->>'provider', ''), 'unknown')`;
const modelExpr = `COALESCE(NULLIF("metadata"->>'model', ''), 'unknown')`;
const totalTokensExpr = `
  COALESCE(
    NULLIF("metadata"->'usage'->>'totalTokens', '')::bigint,
    NULLIF("metadata"->'usage'->>'total_tokens', '')::bigint,
    NULLIF("metadata"->>'totalTokens', '')::bigint,
    NULLIF("metadata"->>'total_tokens', '')::bigint,
    NULLIF("content"->'usage'->>'totalTokens', '')::bigint,
    NULLIF("content"->'usage'->>'total_tokens', '')::bigint,
    NULLIF("content"->>'totalTokens', '')::bigint,
    NULLIF("content"->>'total_tokens', '')::bigint,
    0
  )
`;
const latencyMsExpr = `
  NULLIF(
    REGEXP_REPLACE(
      COALESCE(
        "metadata"->>'latencyMs',
        "metadata"->>'latency_ms',
        "content"->>'latencyMs',
        "content"->>'latency_ms',
        ''
      ),
      '[^0-9.]',
      '',
      'g'
    ),
    ''
  )::numeric
`;
const latencyMsExprEvents = `
  NULLIF(
    REGEXP_REPLACE(
      COALESCE(
        e."metadata"->>'latencyMs',
        e."metadata"->>'latency_ms',
        e."content"->>'latencyMs',
        e."content"->>'latency_ms',
        ''
      ),
      '[^0-9.]',
      '',
      'g'
    ),
    ''
  )::numeric
`;

// GET /api/analytics/usage - Get usage statistics
app.get('/usage', async (c) => {
  const auth = c.get('whyopsAuth');
  if (!auth) {
    return c.json({ error: 'Unauthorized: authentication required' }, 401);
  }

  try {
    const userId = c.req.query('userId');
    const providerId = c.req.query('providerId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    if (userId && userId !== auth.userId) {
      return c.json({ error: 'Forbidden: cross-user query is not allowed' }, 403);
    }

    const where: any = { userId: auth.userId };
    if (providerId) where.providerId = providerId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[Op.gte] = new Date(startDate);
      if (endDate) where.timestamp[Op.lte] = new Date(endDate);
    }

    const stats = await LLMEvent.findAll({
      attributes: [
        [LLMEvent.sequelize!.literal(providerExpr), 'provider'],
        [LLMEvent.sequelize!.literal(modelExpr), 'model'],
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.col('id')), 'requestCount'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal(totalTokensExpr)), 'totalTokens'],
        [LLMEvent.sequelize!.literal(`AVG(${latencyMsExpr})`), 'avgLatency'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal(`CASE WHEN "event_type" = 'error' THEN 1 ELSE 0 END`)), 'errorCount'],
      ],
      where,
      group: [providerExpr, modelExpr],
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
  const auth = c.get('whyopsAuth');
  if (!auth) {
    return c.json({ error: 'Unauthorized: authentication required' }, 401);
  }

  try {
    const userId = c.req.query('userId');
    const providerId = c.req.query('providerId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const interval = c.req.query('interval') || 'hour'; // hour, day, week

    if (userId && userId !== auth.userId) {
      return c.json({ error: 'Forbidden: cross-user query is not allowed' }, 403);
    }

    const where: any = { userId: auth.userId };
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
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal(totalTokensExpr)), 'totalTokens'],
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
  const auth = c.get('whyopsAuth');

  if (!auth) {
    return c.json({ error: 'Unauthorized: authentication required' }, 401);
  }

  try {
    const userId = c.req.query('userId') || auth.userId;
    const providerId = c.req.query('providerId');

    const where: any = { userId };
    if (providerId) where.providerId = providerId;

    const summary = await LLMEvent.findOne({
      attributes: [
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.col('id')), 'totalRequests'],
        [LLMEvent.sequelize!.fn('COUNT', LLMEvent.sequelize!.fn('DISTINCT', LLMEvent.sequelize!.col('trace_id'))), 'totalThreads'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal(totalTokensExpr)), 'totalTokens'],
        [LLMEvent.sequelize!.literal(`AVG(${latencyMsExpr})`), 'avgLatency'],
        [LLMEvent.sequelize!.fn('SUM', LLMEvent.sequelize!.literal(`CASE WHEN "event_type" = 'error' THEN 1 ELSE 0 END`)), 'errorCount'],
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

// GET /api/analytics/dashboard - Get dashboard-specific stats
app.get('/dashboard', async (c) => {
  const auth = c.get('whyopsAuth');

  if (!auth) {
    return c.json({ error: 'Unauthorized: authentication required' }, 401);
  }

  try {
    const agentCount = Math.min(Math.max(parseInt(c.req.query('agentCount') || '5', 10) || 5, 1), 100);

    const scopedReplacements = {
      userId: auth.userId,
      projectId: auth.projectId,
      environmentId: auth.environmentId,
    };

    const scopedAgentCountRows = await Agent.sequelize!.query<{ totalAgents: string | number }>(
      `
        SELECT COUNT(*) AS "totalAgents"
        FROM agents a
        WHERE a.user_id = :userId
          AND a.project_id = :projectId
          AND a.environment_id = :environmentId
      `,
      {
        replacements: scopedReplacements,
        type: QueryTypes.SELECT,
      }
    );

    let useUserScopeFallback = Number(scopedAgentCountRows[0]?.totalAgents || 0) === 0;
    let totalAgents = Number(scopedAgentCountRows[0]?.totalAgents || 0);

    if (useUserScopeFallback) {
      const userScopeAgentCountRows = await Agent.sequelize!.query<{ totalAgents: string | number }>(
        `
          SELECT COUNT(*) AS "totalAgents"
          FROM agents a
          WHERE a.user_id = :userId
        `,
        {
          replacements: { userId: auth.userId },
          type: QueryTypes.SELECT,
        }
      );

      const userScopeAgents = Number(userScopeAgentCountRows[0]?.totalAgents || 0);
      if (userScopeAgents > 0) {
        totalAgents = userScopeAgents;
        logger.warn(
          {
            userId: auth.userId,
            projectId: auth.projectId,
            environmentId: auth.environmentId,
            fallbackTotalAgents: userScopeAgents,
          },
          'Dashboard scoped context returned no agents; falling back to user scope'
        );
      } else {
        useUserScopeFallback = false;
      }
    }

    const scopeClause = useUserScopeFallback
      ? `a.user_id = :userId`
      : `a.user_id = :userId
          AND a.project_id = :projectId
          AND a.environment_id = :environmentId`;

    const baseReplacements = useUserScopeFallback
      ? { userId: auth.userId }
      : scopedReplacements;

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const traceCountRows = await Trace.sequelize!.query<{ totalTraces: string | number; activeTraces: string | number }>(
      `
        SELECT
          COUNT(*) AS "totalTraces",
          COALESCE(SUM(CASE WHEN t.created_at >= :oneDayAgo THEN 1 ELSE 0 END), 0) AS "activeTraces"
        FROM traces t
        JOIN entities e ON e.id = t.entity_id
        JOIN agents a ON a.id = e.agent_id
        WHERE ${scopeClause}
      `,
      {
        replacements: {
          ...baseReplacements,
          oneDayAgo,
        },
        type: QueryTypes.SELECT,
      }
    );
    const totalTraces = Number(traceCountRows[0]?.totalTraces || 0);
    const activeTraces = Number(traceCountRows[0]?.activeTraces || 0);

    const eventStatsRows = await LLMEvent.sequelize!.query<{ totalEvents: string | number; errorEvents: string | number; avgLatency: string | number | null }>(
      `
        SELECT
          COUNT(e.id) AS "totalEvents",
          COALESCE(SUM(CASE WHEN e.event_type = 'error' THEN 1 ELSE 0 END), 0) AS "errorEvents",
          AVG(${latencyMsExprEvents}) AS "avgLatency"
        FROM trace_events e
        JOIN traces t ON t.id = e.trace_id
        JOIN entities en ON en.id = t.entity_id
        JOIN agents a ON a.id = en.agent_id
        WHERE ${scopeClause}
      `,
      {
        replacements: baseReplacements,
        type: QueryTypes.SELECT,
      }
    );

    const totalEvents = Number(eventStatsRows[0]?.totalEvents || 0);
    const errorEvents = Number(eventStatsRows[0]?.errorEvents || 0);

    const successRate = totalEvents > 0
      ? Math.round(((totalEvents - errorEvents) / totalEvents) * 1000) / 10
      : 100;

    const avgLatencyMs = Number(eventStatsRows[0]?.avgLatency || 0);
    const avgLatency = avgLatencyMs > 1000
      ? `${(avgLatencyMs / 1000).toFixed(1)}s`
      : `${Math.round(avgLatencyMs)}ms`;

    // Calculate trend deltas: current 7-day window vs previous 7-day window
    const now = new Date();
    const currentWindowStart = new Date(now);
    currentWindowStart.setDate(currentWindowStart.getDate() - 6);
    currentWindowStart.setHours(0, 0, 0, 0);

    const previousWindowStart = new Date(currentWindowStart);
    previousWindowStart.setDate(previousWindowStart.getDate() - 7);
    const previousWindowEnd = new Date(currentWindowStart);

    const loadPeriodStats = async (from: Date, to: Date) => {
      const rows = await LLMEvent.sequelize!.query<DashboardPeriodStatsRow>(
        `
          SELECT
            COUNT(e.id) AS "totalEvents",
            COALESCE(SUM(CASE WHEN e.event_type = 'error' THEN 1 ELSE 0 END), 0) AS "errorEvents",
            AVG(${latencyMsExprEvents}) AS "avgLatency"
          FROM trace_events e
          JOIN traces t ON t.id = e.trace_id
          JOIN entities en ON en.id = t.entity_id
          JOIN agents a ON a.id = en.agent_id
          WHERE ${scopeClause}
            AND e.timestamp >= :from
            AND e.timestamp < :to
        `,
        {
          replacements: {
            ...baseReplacements,
            from,
            to,
          },
          type: QueryTypes.SELECT,
        }
      );
      return rows[0];
    };

    const [currentPeriodStats, previousPeriodStats] = await Promise.all([
      loadPeriodStats(currentWindowStart, now),
      loadPeriodStats(previousWindowStart, previousWindowEnd),
    ]);

    const currentPeriodTotalEvents = Number(currentPeriodStats?.totalEvents || 0);
    const currentPeriodErrorEvents = Number(currentPeriodStats?.errorEvents || 0);
    const previousPeriodTotalEvents = Number(previousPeriodStats?.totalEvents || 0);
    const previousPeriodErrorEvents = Number(previousPeriodStats?.errorEvents || 0);

    const currentPeriodSuccessRate = currentPeriodTotalEvents > 0
      ? ((currentPeriodTotalEvents - currentPeriodErrorEvents) / currentPeriodTotalEvents) * 100
      : null;
    const previousPeriodSuccessRate = previousPeriodTotalEvents > 0
      ? ((previousPeriodTotalEvents - previousPeriodErrorEvents) / previousPeriodTotalEvents) * 100
      : null;

    const currentPeriodAvgLatencyMs =
      currentPeriodStats?.avgLatency === null || currentPeriodStats?.avgLatency === undefined
        ? null
        : Number(currentPeriodStats.avgLatency);
    const previousPeriodAvgLatencyMs =
      previousPeriodStats?.avgLatency === null || previousPeriodStats?.avgLatency === undefined
        ? null
        : Number(previousPeriodStats.avgLatency);

    const successRateDelta =
      currentPeriodSuccessRate !== null && previousPeriodSuccessRate !== null
        ? Math.round((currentPeriodSuccessRate - previousPeriodSuccessRate) * 10) / 10
        : null;

    const avgLatencyDeltaMs =
      currentPeriodAvgLatencyMs !== null &&
      previousPeriodAvgLatencyMs !== null &&
      Number.isFinite(currentPeriodAvgLatencyMs) &&
      Number.isFinite(previousPeriodAvgLatencyMs)
        ? Math.round(currentPeriodAvgLatencyMs - previousPeriodAvgLatencyMs)
        : null;

    // Get success rate timeline for chart (last 7 days)
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const dailyRows = await LLMEvent.sequelize!.query<DashboardDailySuccessRow>(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', e.timestamp AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS "day",
          COUNT(*) AS "totalEvents",
          COALESCE(SUM(CASE WHEN e.event_type = 'error' THEN 1 ELSE 0 END), 0) AS "errorEvents"
        FROM trace_events e
        JOIN traces t ON t.id = e.trace_id
        JOIN entities en ON en.id = t.entity_id
        JOIN agents a ON a.id = en.agent_id
        WHERE ${scopeClause}
          AND e.timestamp >= :since
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      {
        replacements: {
          ...baseReplacements,
          since,
        },
        type: QueryTypes.SELECT,
      }
    );

    const byDay = new Map<string, { total: number; errors: number }>();
    for (const row of dailyRows) {
      byDay.set(row.day, {
        total: Number(row.totalEvents || 0),
        errors: Number(row.errorEvents || 0),
      });
    }

    const timelineData = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(since);
      dayDate.setDate(since.getDate() + i);
      const dayKey = dayDate.toISOString().slice(0, 10);
      const stats = byDay.get(dayKey);
      const daySuccess = stats && stats.total > 0
        ? Math.round(((stats.total - stats.errors) / stats.total) * 100)
        : 0;

      timelineData.push({
        day: dayDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        value: daySuccess,
      });
    }

    const agentUsageRows = await Agent.sequelize!.query<{ name: string; traceCount: string | number }>(
      `
        SELECT
          a.name AS "name",
          COUNT(DISTINCT t.id) AS "traceCount"
        FROM agents a
        LEFT JOIN entities e ON e.agent_id = a.id
        LEFT JOIN traces t ON t.entity_id = e.id
        WHERE ${scopeClause}
        GROUP BY a.id
        ORDER BY COUNT(DISTINCT t.id) DESC
        LIMIT :agentCount
      `,
      {
        replacements: {
          ...baseReplacements,
          agentCount,
        },
        type: QueryTypes.SELECT,
      }
    );

    const agentsUsage: Record<string, number> = {};
    for (const row of agentUsageRows) {
      agentsUsage[row.name] = Number(row.traceCount || 0);
    }

    return c.json({
      totalAgents,
      activeTraces,
      successRate,
      avgLatency,
      successRateDelta,
      avgLatencyDeltaMs,
      timeline: timelineData,
      agentsUsage,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch dashboard stats');
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500);
  }
});

export default app;
