import { createServiceLogger } from '@whyops/shared/logger';
import { Entity, LLMEvent, Trace } from '@whyops/shared/models';
import { llmCostService } from '@whyops/shared/services';
import { compressPayload, decompressPayload, toPayloadEvent, type PayloadEvent } from '@whyops/shared/lib/events-payload';
import { Op, QueryTypes } from 'sequelize';

const logger = createServiceLogger('analyse:thread-service');

// Typed columns are populated at ingestion time (Phase 2 migration).
// JSONB fallbacks handle rows written before the migration.
const totalTokensExpr = `
  COALESCE(
    NULLIF(prompt_tokens, 0) + NULLIF(completion_tokens, 0),
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
  COALESCE(
    latency_ms,
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
  )
`;

export interface ThreadListItem {
  threadId: string;
  userId: string;
  externalUserId?: string;
  providerId?: string;
  agentId?: string;
  entityId?: string;
  entityName?: string;
  model?: string;
  systemPrompt?: string;
  tools?: any[];
  metadata?: Record<string, any>;
  lastActivity: Date;
  lastEventTimestamp?: Date;
  eventCount: number;
  duration?: number; // milliseconds
  firstEventTimestamp?: Date;
}

interface ThreadListRow {
  threadId: string;
  userId: string;
  externalUserId?: string;
  providerId?: string;
  agentId?: string;
  entityId?: string;
  entityName?: string;
  model?: string;
  systemPrompt?: string;
  tools?: any;
  metadata?: any;
  lastActivity: string | Date;
  lastEventTimestamp?: string | Date;
  eventCount: string | number;
  firstEventTimestamp?: string | Date;
  duration?: string | number;
}

interface ThreadCountRow {
  total: string | number;
}

export interface EventDetail {
  id: string;
  stepId: number;
  parentStepId?: number;
  spanId?: string;
  eventType: string;
  timestamp: Date;
  content?: any;
  metadata?: any;
  // Typed fields extracted from metadata at ingestion (Phase 2)
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheWriteTokens?: number | null;
  latencyMs?: number | null;
  finishReason?: string | null;
  duration?: number; // Time from this event to next event in ms
  timeSinceStart?: number; // Time from thread start in ms
  isLateEvent?: boolean; // Event arrived after subsequent events
}

export interface ModelBreakdown {
  model: string;
  /** Non-cached input tokens only. */
  inputTokens: number;
  outputTokens: number;
  /** Tokens written to 5-minute cache. */
  cacheWrite5mTokens: number;
  /** Tokens written to 1-hour cache. */
  cacheWrite1hTokens: number;
  /** Total cache-write tokens (5m + 1h). */
  cacheCreationTokens: number;
  /** Tokens served from cache (cache hit). */
  cacheReadTokens: number;
  /** Sum of all input token types + output. */
  totalTokens: number;
  totalCost: number;
  cost: any | null; // LlmCost record (pricing rates + contextWindow)
  isLastModel: boolean;
  contextWindowUsed?: number;
  contextWindowFillPct?: number;
}

export interface ThreadDetail {
  threadId: string;
  userId: string;
  externalUserId?: string;
  providerId?: string;
  sampledIn?: boolean;
  agentId?: string;
  entityId?: string;
  entityName?: string;
  lastActivity: Date;
  model?: string;
  systemPrompt?: string;
  tools?: any[];
  metadata?: Record<string, any>;
  // Timing
  firstEventTimestamp: Date;
  lastEventTimestamp: Date;
  duration: number; // milliseconds from first to last event
  // Statistics
  eventCount: number;
  totalTokens: number;
  totalLatency: number;
  avgLatency: number;
  errorCount: number;
  // Events with detailed timing
  events: EventDetail[];
  // Late events detection
  hasLateEvents: boolean;
  eventsPagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  /** @deprecated use models instead */
  cost?: any[];
  /** Per-model breakdown with costs and token usage */
  models?: ModelBreakdown[];
  /** Total cost across all models in USD */
  totalCost?: number;
}

export interface GraphNode {
  id: string;
  stepId: number;
  parentStepId?: number;
  type: string;
  model?: string;
  timestamp: Date;
  latencyMs?: number;
  hasError: boolean;
  duration?: number;
  timeSinceStart?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export class ThreadService {
  /**
   * List all threads with duration calculation
   */
  static async listThreads(filters: {
    userId: string;
    agentName?: string;
    agentId?: string;
    externalUserId?: string;
    page?: number;
    count?: number;
    includeSystemPrompt?: boolean;
    includeTools?: boolean;
    includeMetadata?: boolean;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ threads: ThreadListItem[]; pagination: { total: number; count: number; page: number; totalPages: number; hasMore: boolean } }> {
    const { userId, agentName, agentId, externalUserId, page = 1, count = 20, includeSystemPrompt = false, includeTools = false, includeMetadata = false, startDate, endDate } = filters;
    const offset = (page - 1) * count;

    try {
      const countRows = await Trace.sequelize!.query<ThreadCountRow>(
        `
          WITH event_stats AS (
            SELECT
              ev.trace_id AS trace_id,
              MAX(ev.timestamp) AS last_event_timestamp
            FROM trace_events ev
            WHERE (:startDate IS NULL OR ev.timestamp >= :startDate)
              AND (:endDate IS NULL OR ev.timestamp <= :endDate)
            GROUP BY ev.trace_id
          )
          SELECT COUNT(DISTINCT t.id) AS total
          FROM traces t
          LEFT JOIN entities e ON e.id = t.entity_id
          LEFT JOIN agents a ON a.id = e.agent_id
          LEFT JOIN event_stats es ON es.trace_id = t.id
          WHERE t.user_id = :userId
            AND (:agentName IS NULL OR a.name = :agentName)
            AND (:agentId IS NULL OR a.id = :agentId)
            AND (:externalUserId IS NULL OR t.external_user_id = :externalUserId)
            AND (:startDate IS NULL OR COALESCE(es.last_event_timestamp, t.created_at) >= :startDate)
            AND (:endDate IS NULL OR COALESCE(es.last_event_timestamp, t.created_at) <= :endDate)
        `,
        {
          replacements: {
            userId,
            agentName: agentName || null,
            agentId: agentId || null,
            externalUserId: externalUserId || null,
            startDate: startDate || null,
            endDate: endDate || null,
          },
          type: QueryTypes.SELECT,
        }
      );

      const total = Number(countRows[0]?.total || 0);

      const selectFields = [
        `t.id AS "threadId"`,
        `t.user_id AS "userId"`,
        `t.external_user_id AS "externalUserId"`,
        `COALESCE(t.provider_id, le.provider_id) AS "providerId"`,
        `a.id AS "agentId"`,
        `t.entity_id AS "entityId"`,
        `e.name AS "entityName"`,
        `COALESCE(
          t.model,
          NULLIF(le.metadata->>'model', ''),
          NULLIF(le.metadata->>'modelName', '')
        ) AS "model"`,
        `COALESCE(es.last_event_timestamp, t.created_at) AS "lastActivity"`,
        `es.last_event_timestamp AS "lastEventTimestamp"`,
        `COALESCE(es.event_count, 0) AS "eventCount"`,
        `es.first_event_timestamp AS "firstEventTimestamp"`,
        `CASE
          WHEN COALESCE(es.event_count, 0) > 0
            THEN EXTRACT(EPOCH FROM (es.last_event_timestamp - es.first_event_timestamp)) * 1000
          ELSE NULL
        END AS "duration"`,
      ];

      if (includeSystemPrompt) {
        selectFields.push(
          `COALESCE(
            t.system_message,
            NULLIF(e.metadata->>'systemPrompt', '')
          ) AS "systemPrompt"`
        );
      }

      if (includeTools) {
        selectFields.push(
          `COALESCE(
            t.tools,
            e.metadata->'tools'
          ) AS "tools"`
        );
      }

      if (includeMetadata) {
        selectFields.push(`t.metadata AS "metadata"`);
      }

      const rows = await Trace.sequelize!.query<ThreadListRow>(
        `
          WITH event_stats AS (
            SELECT
              ev.trace_id AS trace_id,
              MAX(ev.timestamp) AS last_event_timestamp,
              MIN(ev.timestamp) AS first_event_timestamp,
              COUNT(ev.id) AS event_count
            FROM trace_events ev
            WHERE (:startDate IS NULL OR ev.timestamp >= :startDate)
              AND (:endDate IS NULL OR ev.timestamp <= :endDate)
            GROUP BY ev.trace_id
          ),
          latest_event AS (
            SELECT DISTINCT ON (ev.trace_id)
              ev.trace_id,
              ev.provider_id,
              ev.metadata
            FROM trace_events ev
            ORDER BY ev.trace_id, ev.timestamp DESC
          )
          SELECT
            ${selectFields.join(',\n            ')}
          FROM traces t
          LEFT JOIN entities e ON e.id = t.entity_id
          LEFT JOIN agents a ON a.id = e.agent_id
          LEFT JOIN event_stats es ON es.trace_id = t.id
          LEFT JOIN latest_event le ON le.trace_id = t.id
          WHERE t.user_id = :userId
            AND (:agentName IS NULL OR a.name = :agentName)
            AND (:agentId IS NULL OR a.id = :agentId)
            AND (:externalUserId IS NULL OR t.external_user_id = :externalUserId)
            AND (:startDate IS NULL OR COALESCE(es.last_event_timestamp, t.created_at) >= :startDate)
            AND (:endDate IS NULL OR COALESCE(es.last_event_timestamp, t.created_at) <= :endDate)
          ORDER BY COALESCE(es.last_event_timestamp, t.created_at) DESC
          LIMIT :count OFFSET :offset
        `,
        {
          replacements: {
            userId,
            agentName: agentName || null,
            agentId: agentId || null,
            externalUserId: externalUserId || null,
            count,
            offset,
            startDate: startDate || null,
            endDate: endDate || null,
          },
          type: QueryTypes.SELECT,
        }
      );

      const threads: ThreadListItem[] = rows.map((row) => ({
        threadId: row.threadId,
        userId: row.userId,
        externalUserId: row.externalUserId || undefined,
        providerId: row.providerId,
        agentId: row.agentId,
        entityId: row.entityId,
        entityName: row.entityName,
        model: row.model,
        systemPrompt: row.systemPrompt,
        tools: row.tools,
        metadata: row.metadata,
        lastActivity: new Date(row.lastActivity),
        lastEventTimestamp: row.lastEventTimestamp ? new Date(row.lastEventTimestamp) : undefined,
        eventCount: Number(row.eventCount || 0),
        duration: row.duration === null || row.duration === undefined ? undefined : Number(row.duration),
        firstEventTimestamp: row.firstEventTimestamp ? new Date(row.firstEventTimestamp) : undefined,
      }));

      return {
        threads,
        pagination: {
          total,
          count,
          page,
          totalPages: Math.ceil(total / count),
          hasMore: page * count < total,
        },
      };
    } catch (error) {
      logger.error({ error, userId, agentName, page, count }, 'Failed to list threads');
      throw new Error('Failed to list threads');
    }
  }

  /**
   * Get complete thread details with timing analysis
   */
  static async getThreadDetail(
    threadId: string,
    userId: string,
    options?: {
      includeSystemPrompt?: boolean;
      includeTools?: boolean;
      includeMetadata?: boolean;
      eventIncludeContent?: boolean;
      eventIncludeMetadata?: boolean;
      eventLimit?: number;
      eventOffset?: number;
    }
  ): Promise<ThreadDetail | null> {
    try {
      const includeSystemPrompt = options?.includeSystemPrompt ?? false;
      const includeTools = options?.includeTools ?? false;
      const includeMetadata = options?.includeMetadata ?? false;
      const eventIncludeContent = options?.eventIncludeContent ?? false;
      const eventIncludeMetadata = options?.eventIncludeMetadata ?? false;
      const eventLimit = Math.min(Math.max(options?.eventLimit ?? 200, 1), 1000);
      const eventOffset = Math.max(options?.eventOffset ?? 0, 0);

      // Get trace with entity information
      const trace = await Trace.findOne({
        where: {
          id: threadId,
          userId,
        },
        include: [
          {
            model: Entity,
            as: 'entity',
            attributes: ['id', 'agentId', 'name', 'metadata'],
            required: false,
          },
        ],
      });

      if (!trace) {
        return null;
      }

      const entityMetadata = (trace as any).entity?.metadata as Record<string, any> | undefined;
      const resolvedSystemPrompt = includeSystemPrompt
        ? (trace.systemMessage || entityMetadata?.systemPrompt || undefined)
        : undefined;
      const resolvedTools = includeTools
        ? (trace.tools || entityMetadata?.tools || undefined)
        : undefined;

      const modelForCost = trace.model || (trace.metadata as any)?.model;

      // ── Per-model token usage from events ────────────────────────────────
      interface ModelTokenRow {
        model: string;
        inputTokens: string | number;
        outputTokens: string | number;
        cacheWrite5mTokens: string | number;
        cacheWrite1hTokens: string | number;
        cacheCreationTokens: string | number;
        cacheReadTokens: string | number;
        totalTokens: string | number;
      }

      const modelTokenRows = await LLMEvent.sequelize!.query<ModelTokenRow>(
        `
          SELECT
            COALESCE(
              model,
              NULLIF(metadata->>'model', ''),
              NULLIF(metadata->>'modelName', '')
            ) AS model,
            SUM(COALESCE(
              prompt_tokens,
              NULLIF(metadata->'usage'->>'inputTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'promptTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'input', '')::bigint,
              0
            )) AS "inputTokens",
            SUM(COALESCE(
              completion_tokens,
              NULLIF(metadata->'usage'->>'outputTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'completionTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'output', '')::bigint,
              0
            )) AS "outputTokens",
            SUM(COALESCE(
              cache_write_tokens,
              NULLIF(metadata->'usage'->>'cacheWrite5mTokens', '')::bigint,
              0
            )) AS "cacheWrite5mTokens",
            SUM(COALESCE(
              NULLIF(metadata->'usage'->>'cacheWrite1hTokens', '')::bigint,
              0
            )) AS "cacheWrite1hTokens",
            SUM(COALESCE(
              NULLIF(metadata->'usage'->>'cacheCreationTokens', '')::bigint,
              0
            )) AS "cacheCreationTokens",
            SUM(COALESCE(
              cache_read_tokens,
              NULLIF(metadata->'usage'->>'cacheReadTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'cachedTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'cacheRead', '')::bigint,
              0
            )) AS "cacheReadTokens",
            SUM(COALESCE(
              prompt_tokens + completion_tokens,
              NULLIF(metadata->'usage'->>'totalTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'total_tokens', '')::bigint,
              0
            )) AS "totalTokens"
          FROM trace_events
          WHERE trace_id = :traceId
            AND event_type = 'llm_response'
            AND COALESCE(
              model,
              NULLIF(metadata->>'model', ''),
              NULLIF(metadata->>'modelName', '')
            ) IS NOT NULL
          GROUP BY 1
        `,
        { replacements: { traceId: threadId }, type: QueryTypes.SELECT }
      );

      // Last llm_response event — model + token count for context window fill
      interface LastEventRow {
        model: string | null;
        inputTokens: string | number;
        outputTokens: string | number;
      }

      const lastEventRows = await LLMEvent.sequelize!.query<LastEventRow>(
        `
          SELECT
            COALESCE(
              model,
              NULLIF(metadata->>'model', ''),
              NULLIF(metadata->>'modelName', '')
            ) AS model,
            COALESCE(
              prompt_tokens,
              NULLIF(metadata->'usage'->>'inputTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'promptTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'input', '')::bigint,
              0
            ) AS "inputTokens",
            COALESCE(
              completion_tokens,
              NULLIF(metadata->'usage'->>'outputTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'completionTokens', '')::bigint,
              NULLIF(metadata->'usage'->>'output', '')::bigint,
              0
            ) AS "outputTokens"
          FROM trace_events
          WHERE trace_id = :traceId
            AND event_type = 'llm_response'
          ORDER BY timestamp DESC
          LIMIT 1
        `,
        { replacements: { traceId: threadId }, type: QueryTypes.SELECT }
      );

      const lastEventModel = lastEventRows[0]?.model ?? null;

      // Determine unique model names: from events + fallback to trace.model
      const eventModelNames = modelTokenRows.map((r) => r.model);
      const allModelNames = eventModelNames.length > 0
        ? eventModelNames
        : (modelForCost ? [modelForCost] : []);

      // Fetch cost records for all models in parallel
      const costRecords = await Promise.all(
        allModelNames.map((m) => llmCostService.getCosts([m]).then((r: any[]) => r?.[0] ?? null).catch(() => null))
      );
      const costByModel = new Map<string, any>(
        allModelNames.map((m, i) => [m, costRecords[i]])
      );

      const TOKENS_PER_MILLION = 1_000_000;

      const models: ModelBreakdown[] = [];
      let totalCost = 0;

      for (const row of modelTokenRows) {
        const costRecord = costByModel.get(row.model) ?? null;
        const inputTokens = Number(row.inputTokens || 0);
        const outputTokens = Number(row.outputTokens || 0);
        const cacheWrite5mTokens = Number(row.cacheWrite5mTokens || 0);
        const cacheWrite1hTokens = Number(row.cacheWrite1hTokens || 0);
        const cacheCreationTokens = Number(row.cacheCreationTokens || 0);
        const cacheReadTokens = Number(row.cacheReadTokens || 0);
        const rowTotal = Number(row.totalTokens || 0);

        // Total cache-write tokens: prefer split TTL values, fall back to combined total
        const effectiveCacheWrite5m = cacheWrite5mTokens || (cacheCreationTokens > 0 && cacheWrite1hTokens === 0 ? cacheCreationTokens : 0);
        const effectiveCacheWrite1h = cacheWrite1hTokens;

        let modelCost = 0;
        if (costRecord) {
          const hasSplit = inputTokens > 0 || outputTokens > 0 || cacheReadTokens > 0 || cacheCreationTokens > 0;
          if (hasSplit) {
            modelCost =
              (inputTokens / TOKENS_PER_MILLION) * costRecord.inputTokenPricePerMillionToken +
              (outputTokens / TOKENS_PER_MILLION) * costRecord.outputTokenPricePerMillionToken +
              (effectiveCacheWrite5m / TOKENS_PER_MILLION) * (costRecord.cacheWrite5mTokenPricePerMillionToken || 0) +
              (effectiveCacheWrite1h / TOKENS_PER_MILLION) * (costRecord.cacheWrite1hTokenPricePerMillionToken || 0) +
              (cacheReadTokens / TOKENS_PER_MILLION) * (costRecord.cacheReadTokenPricePerMillionToken || 0);
          } else if (rowTotal > 0) {
            const blended = (costRecord.inputTokenPricePerMillionToken + costRecord.outputTokenPricePerMillionToken) / 2;
            modelCost = (rowTotal / TOKENS_PER_MILLION) * blended;
          }
        }

        totalCost += modelCost;
        const isLastModel = row.model === lastEventModel;

        const breakdown: ModelBreakdown = {
          model: row.model,
          inputTokens,
          outputTokens,
          cacheWrite5mTokens,
          cacheWrite1hTokens,
          cacheCreationTokens,
          cacheReadTokens,
          totalTokens: rowTotal || inputTokens + cacheCreationTokens + cacheReadTokens + outputTokens,
          totalCost: modelCost,
          cost: costRecord,
          isLastModel,
        };

        if (isLastModel && lastEventRows[0]) {
          const lastIn = Number(lastEventRows[0].inputTokens || 0);
          const lastOut = Number(lastEventRows[0].outputTokens || 0);
          const used = lastIn + lastOut;
          const contextWindow = costRecord?.contextWindow ? Number(costRecord.contextWindow) : null;
          breakdown.contextWindowUsed = used;
          if (contextWindow && contextWindow > 0) {
            breakdown.contextWindowFillPct = Math.min(used / contextWindow, 1);
          }
        }

        models.push(breakdown);
      }

      // Fallback: if no events had model metadata but trace has a model, still return cost
      let cost: any[] = [];
      if (models.length === 0 && modelForCost) {
        try {
          cost = (await llmCostService.getCosts([modelForCost])) || [];
        } catch (costError) {
          logger.warn({ costError, threadId, modelForCost }, 'Failed to resolve thread cost; returning thread without cost details');
          cost = [];
        }
      } else {
        cost = models.map((m) => m.cost).filter(Boolean);
      }

      interface ThreadSummaryRow {
        eventCount: string | number;
        firstEventTimestamp: string | Date | null;
        lastEventTimestamp: string | Date | null;
        totalTokens: string | number | null;
        totalLatency: string | number | null;
        errorCount: string | number | null;
      }

      const summaryRows = await LLMEvent.sequelize!.query<ThreadSummaryRow>(
        `
          SELECT
            COUNT(id) AS "eventCount",
            MIN(timestamp) AS "firstEventTimestamp",
            MAX(timestamp) AS "lastEventTimestamp",
            SUM(${totalTokensExpr}) AS "totalTokens",
            SUM(${latencyMsExpr}) AS "totalLatency",
            COALESCE(SUM(CASE WHEN event_type = 'error' THEN 1 ELSE 0 END), 0) AS "errorCount"
          FROM trace_events
          WHERE trace_id = :traceId
        `,
        {
          replacements: { traceId: threadId },
          type: QueryTypes.SELECT,
        }
      );

      const summary = summaryRows[0];
      const eventCount = Number(summary?.eventCount || 0);

      if (eventCount === 0 || !summary?.firstEventTimestamp || !summary?.lastEventTimestamp) {
        const createdAt = trace.createdAt;
        return {
          threadId: trace.id,
          userId: trace.userId,
          externalUserId: trace.externalUserId || undefined,
          providerId: trace.providerId,
          sampledIn: trace.sampledIn,
          agentId: (trace as any).entity?.agentId,
          entityId: trace.entityId,
          entityName: (trace as any).entity?.name,
          lastActivity: createdAt,
          model: trace.model || (trace.metadata as any)?.model,
          systemPrompt: resolvedSystemPrompt,
          tools: resolvedTools,
          metadata: includeMetadata ? trace.metadata : undefined,
          firstEventTimestamp: createdAt,
          lastEventTimestamp: createdAt,
          duration: 0,
          eventCount: 0,
          totalTokens: 0,
          totalLatency: 0,
          avgLatency: 0,
          errorCount: 0,
          events: [],
          hasLateEvents: false,
          eventsPagination: {
            total: 0,
            limit: eventLimit,
            offset: eventOffset,
            hasMore: false,
          },
          cost,
          models,
          totalCost,
        };
      }

      const firstEventTimestamp = new Date(summary.firstEventTimestamp);
      const lastEventTimestamp = new Date(summary.lastEventTimestamp);
      const duration = lastEventTimestamp.getTime() - firstEventTimestamp.getTime();
      const totalTokens = Number(summary.totalTokens || 0);
      const totalLatency = Number(summary.totalLatency || 0);
      const errorCount = Number(summary.errorCount || 0);

      const lateRows = await LLMEvent.sequelize!.query<{ hasLate: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM (
              SELECT
                step_id,
                MAX(step_id) OVER (ORDER BY timestamp) AS max_step
              FROM trace_events
              WHERE trace_id = :traceId
            ) s
            WHERE s.step_id < s.max_step
          ) AS "hasLate"
        `,
        {
          replacements: { traceId: threadId },
          type: QueryTypes.SELECT,
        }
      );
      const hasLateEvents = Boolean(lateRows[0]?.hasLate);

      // ---------------------------------------------------------------------------
      // Phase 4: Compressed payload cache
      // If eventsPayload is set and still valid (not invalidated by a new write),
      // serve events from the compressed blob. Otherwise fetch from trace_events,
      // build the payload, store it, and return.
      // Pagination is applied after decompression; payload is only used when
      // fetching all events (offset == 0 and no hard limit).
      // ---------------------------------------------------------------------------
      const usePayloadCache = eventIncludeContent && trace.eventsPayload && trace.eventsPayloadAt;

      let cachedPayloadEvents: PayloadEvent[] | null = null;
      if (usePayloadCache) {
        try {
          cachedPayloadEvents = decompressPayload(trace.eventsPayload as Buffer);
        } catch (decompressError) {
          logger.warn({ decompressError, threadId }, 'Failed to decompress events payload, falling back to DB');
          cachedPayloadEvents = null;
        }
      }

      let events: LLMEvent[];
      let builtPayloadFromDb = false;

      if (cachedPayloadEvents && eventOffset === 0) {
        // Serve page from cached payload
        const pageSlice = cachedPayloadEvents.slice(eventOffset, eventOffset + eventLimit + 1);
        const hasMoreEvents = pageSlice.length > eventLimit;
        const pageEvents = hasMoreEvents ? pageSlice.slice(0, eventLimit) : pageSlice;
        const nextPayloadEvent = hasMoreEvents ? pageSlice[eventLimit] : undefined;

        let maxStepSeen = Number.MIN_SAFE_INTEGER;
        const eventDetails: EventDetail[] = pageEvents.map((pe, index) => {
          const ts = new Date(pe.ts);
          const timeSinceStart = ts.getTime() - firstEventTimestamp.getTime();
          const next = index === pageEvents.length - 1 ? nextPayloadEvent : pageEvents[index + 1];
          const eventDuration = next ? new Date(next.ts).getTime() - ts.getTime() : undefined;
          const isLateEvent = pe.sid < maxStepSeen;
          if (pe.sid > maxStepSeen) maxStepSeen = pe.sid;
          return {
            id: pe.id,
            stepId: pe.sid,
            parentStepId: pe.psid,
            spanId: pe.spid,
            eventType: pe.t,
            timestamp: ts,
            content: eventIncludeContent ? pe.c : undefined,
            metadata: eventIncludeMetadata ? { model: pe.model, latencyMs: pe.lat, usage: { promptTokens: pe.pt, completionTokens: pe.ct, cacheReadTokens: pe.crt, cacheWriteTokens: pe.cwt } } : undefined,
            duration: eventDuration,
            timeSinceStart,
            isLateEvent,
          };
        });

        return {
          threadId: trace.id,
          userId: trace.userId,
          externalUserId: trace.externalUserId || undefined,
          providerId: trace.providerId,
          sampledIn: trace.sampledIn,
          agentId: (trace as any).entity?.agentId,
          entityId: trace.entityId,
          entityName: (trace as any).entity?.name,
          lastActivity: lastEventTimestamp,
          model: lastEventModel || trace.model || (trace.metadata as any)?.model,
          systemPrompt: resolvedSystemPrompt,
          tools: resolvedTools,
          metadata: includeMetadata ? trace.metadata : undefined,
          firstEventTimestamp,
          lastEventTimestamp,
          duration,
          eventCount,
          totalTokens,
          totalLatency,
          avgLatency: eventCount > 0 ? totalLatency / eventCount : 0,
          errorCount,
          events: eventDetails,
          hasLateEvents,
          eventsPagination: {
            total: eventCount,
            limit: eventLimit,
            offset: eventOffset,
            hasMore: eventOffset + eventLimit < eventCount,
          },
          cost,
          models,
          totalCost,
        };
      }

      // Cache miss — fetch from trace_events
      const attributes = [
        'id',
        'stepId',
        'parentStepId',
        'spanId',
        'eventType',
        'timestamp',
        'model',
        'promptTokens',
        'completionTokens',
        'cacheReadTokens',
        'cacheWriteTokens',
        'latencyMs',
        'finishReason',
      ] as const;
      const eventAttributes = [...attributes] as string[];
      if (eventIncludeContent) eventAttributes.push('content');
      if (eventIncludeMetadata) eventAttributes.push('metadata');

      if (eventOffset === 0) {
        // Fetch all events to build the payload cache, then page
        events = await LLMEvent.findAll({
          where: { traceId: threadId },
          attributes: eventAttributes,
          order: [['timestamp', 'ASC']],
        });
        builtPayloadFromDb = true;
      } else {
        events = await LLMEvent.findAll({
          where: { traceId: threadId },
          attributes: eventAttributes,
          order: [['timestamp', 'ASC']],
          limit: eventLimit + 1,
          offset: eventOffset,
        });
      }

      const hasMoreEvents = events.length > eventLimit;
      const pageEvents = builtPayloadFromDb
        ? (events.length > eventLimit ? events.slice(0, eventLimit) : events)
        : (hasMoreEvents ? events.slice(0, eventLimit) : events);
      const nextEventForLast = builtPayloadFromDb
        ? (events.length > eventLimit ? events[eventLimit] : undefined)
        : (hasMoreEvents ? events[eventLimit] : undefined);

      // Build and store compressed payload on cache miss (only for full fetches)
      if (builtPayloadFromDb && eventIncludeContent) {
        try {
          const payloadEvents = events.map((e) => toPayloadEvent(e as any));
          const compressed = compressPayload(payloadEvents);
          await Trace.update(
            { eventsPayload: compressed, eventsPayloadAt: new Date() },
            { where: { id: threadId } }
          );
        } catch (compressError) {
          logger.warn({ compressError, threadId }, 'Failed to build events payload cache; continuing without cache');
        }
      }

      let maxStepSeen = Number.MIN_SAFE_INTEGER;
      if (eventOffset > 0) {
        const maxStepRows = await LLMEvent.sequelize!.query<{ maxStep: string | number | null }>(
          `
            SELECT MAX(step_id) AS "maxStep"
            FROM (
              SELECT step_id
              FROM trace_events
              WHERE trace_id = :traceId
              ORDER BY timestamp ASC
              LIMIT :offset
            ) s
          `,
          {
            replacements: { traceId: threadId, offset: eventOffset },
            type: QueryTypes.SELECT,
          }
        );
        maxStepSeen = Number(maxStepRows[0]?.maxStep ?? Number.MIN_SAFE_INTEGER);
      }

      const eventDetails: EventDetail[] = pageEvents.map((event, index) => {
        const timeSinceStart =
          event.timestamp.getTime() - firstEventTimestamp.getTime();

        const nextEvent = index === pageEvents.length - 1 ? nextEventForLast : pageEvents[index + 1];
        const eventDuration = nextEvent
          ? nextEvent.timestamp.getTime() - event.timestamp.getTime()
          : undefined;

        const isLateEvent = event.stepId < maxStepSeen;
        if (event.stepId > maxStepSeen) {
          maxStepSeen = event.stepId;
        }

        return {
          id: event.id,
          stepId: event.stepId,
          parentStepId: event.parentStepId,
          spanId: event.spanId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          content: eventIncludeContent ? (event as any).content : undefined,
          metadata: eventIncludeMetadata ? (event as any).metadata : undefined,
          model: (event as any).model ?? null,
          promptTokens: (event as any).promptTokens ?? null,
          completionTokens: (event as any).completionTokens ?? null,
          cacheReadTokens: (event as any).cacheReadTokens ?? null,
          cacheWriteTokens: (event as any).cacheWriteTokens ?? null,
          latencyMs: (event as any).latencyMs ?? null,
          finishReason: (event as any).finishReason ?? null,
          duration: eventDuration,
          timeSinceStart,
          isLateEvent,
        };
      });

      return {
        threadId: trace.id,
        userId: trace.userId,
        externalUserId: trace.externalUserId || undefined,
        providerId: trace.providerId,
        sampledIn: trace.sampledIn,
        agentId: (trace as any).entity?.agentId,
        entityId: trace.entityId,
        entityName: (trace as any).entity?.name,
        lastActivity: lastEventTimestamp,
        model: lastEventModel || trace.model || (trace.metadata as any)?.model,
        systemPrompt: resolvedSystemPrompt,
        tools: resolvedTools,
        metadata: includeMetadata ? trace.metadata : undefined,
        firstEventTimestamp,
        lastEventTimestamp,
        duration,
        eventCount,
        totalTokens,
        totalLatency,
        avgLatency: eventCount > 0 ? totalLatency / eventCount : 0,
        errorCount,
        events: eventDetails,
        hasLateEvents,
        eventsPagination: {
          total: eventCount,
          limit: eventLimit,
          offset: eventOffset,
          hasMore: eventOffset + eventLimit < eventCount,
        },
        cost,
        models,
        totalCost,
      };
    } catch (error) {
      logger.error({ error, threadId }, 'Failed to get thread detail');
      throw new Error('Failed to get thread detail');
    }
  }

  /**
   * Get thread decision graph
   */
  static async getThreadGraph(
    threadId: string,
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] } | null> {
    try {
      const startDate = options?.startDate;
      const endDate = options?.endDate;

      const where: any = { traceId: threadId };
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp[Op.gte] = startDate;
        if (endDate) where.timestamp[Op.lte] = endDate;
      }

      const events = await LLMEvent.findAll({
        where,
        attributes: ['id', 'stepId', 'parentStepId', 'eventType', 'timestamp', 'metadata'],
        order: [['timestamp', 'ASC']],
      });

      if (events.length === 0) {
        return null;
      }

      const firstEventTimestamp = events[0].timestamp.getTime();

      // Build nodes with timing information
      const nodes: GraphNode[] = events.map((e, index) => {
        const nextEvent = events[index + 1];
        const duration = nextEvent
          ? nextEvent.timestamp.getTime() - e.timestamp.getTime()
          : undefined;

        return {
          id: e.id,
          stepId: e.stepId,
          parentStepId: e.parentStepId,
          type: e.eventType,
          model: e.metadata?.model,
          timestamp: e.timestamp,
          latencyMs: e.metadata?.latencyMs,
          hasError: e.eventType === 'error',
          duration,
          timeSinceStart: e.timestamp.getTime() - firstEventTimestamp,
        };
      });

      // Build edges based on parentStepId relationships
      const edges: GraphEdge[] = events
        .filter((e) => e.parentStepId !== null && e.parentStepId !== undefined)
        .map((e) => {
          const parent = events.find((p) => p.stepId === e.parentStepId);
          return parent
            ? {
                from: parent.id,
                to: e.id,
              }
            : null;
        })
        .filter((edge): edge is GraphEdge => edge !== null);

      return { nodes, edges };
    } catch (error) {
      logger.error({ error, threadId }, 'Failed to build thread graph');
      throw new Error('Failed to build thread graph');
    }
  }

  /**
   * Match messages to existing thread
   */
  static async matchThread(
    userId: string,
    messages: any[],
    providerId: string
  ): Promise<{ found: boolean; traceId?: string; matchEventId?: string; reason?: string }> {
    if (!messages || !Array.isArray(messages) || messages.length < 2) {
      return { found: false, reason: 'Insufficient history' };
    }

    // Find the last assistant message as anchor
    let anchorMessage = null;
    for (let i = messages.length - 2; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        anchorMessage = messages[i];
        break;
      }
    }

    if (!anchorMessage || !anchorMessage.content) {
      return { found: false, reason: 'No anchor message found' };
    }

    try {
      const matchedEvent = await LLMEvent.findOne({
        where: {
          userId,
          providerId,
          eventType: 'llm_response',
          content: {
            [Op.contains]: { content: anchorMessage.content },
          } as any,
        },
        order: [['timestamp', 'DESC']],
      });

      if (matchedEvent) {
        return {
          found: true,
          traceId: matchedEvent.traceId,
          matchEventId: matchedEvent.id,
        };
      }

      return { found: false, reason: 'No matching thread found' };
    } catch (error) {
      logger.error({ error, userId, providerId }, 'Failed to match thread');
      throw new Error('Failed to match thread');
    }
  }
}
