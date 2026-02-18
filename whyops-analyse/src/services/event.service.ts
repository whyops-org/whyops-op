import { createServiceLogger } from '@whyops/shared/logger';
import { LLMEvent } from '@whyops/shared/models';
import { nanoid } from 'nanoid';
import { Op } from 'sequelize';
import { traceQueue } from '../utils/queue';
import { SamplingService } from './sampling.service';
import { TraceService } from './trace.service';

const logger = createServiceLogger('analyse:event-service');

export interface EventData {
  eventType: 'user_message' | 'llm_response' | 'tool_call' | 'tool_call_request' | 'tool_call_response' | 'error';
  traceId: string;
  agentName: string;
  spanId?: string;
  stepId?: number;
  parentStepId?: number;
  userId: string;
  projectId: string;
  environmentId: string;
  providerId?: string;
  timestamp?: string;
  content?: any;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface EventProcessResult {
  id: string | null;
  status: 'saved' | 'skipped' | 'sampled_out';
  stepId?: number;
  parentStepId?: number;
  spanId?: string;
  message?: string;
}

export interface EventListFilters {
  traceId?: string;
  userId?: string;
  providerId?: string;
  limit?: number;
  offset?: number;
}

export class EventService {
  /**
   * Validate event data before processing
   */
  private static validateEventData(data: EventData): void {
    // llm_response events MUST have model and provider in metadata
    if (data.eventType === 'llm_response') {
      const model = data.metadata?.model;
      const provider = data.metadata?.provider;

      if (!model) {
        throw new Error('MISSING_MODEL: llm_response events require "model" in metadata');
      }
      if (!provider) {
        throw new Error('MISSING_PROVIDER: llm_response events require "provider" in metadata');
      }
    }
  }

  /**
   * Process and save an event with idempotency, sampling, and step management
   */
  static async processEvent(data: EventData): Promise<EventProcessResult> {
    // Validate event data
    this.validateEventData(data);

    // Wrap in per-trace queue for sequential processing
    return traceQueue.getQueue(data.traceId).add(async () => {
      // 1. Ensure Trace Exists
      await TraceService.ensureTraceExists({
        traceId: data.traceId,
        userId: data.userId,
        projectId: data.projectId,
        environmentId: data.environmentId,
        providerId: data.providerId,
        agentName: data.agentName,
        content: data.content,
        metadata: data.metadata,
        timestamp: data.timestamp,
      });

      // 2. Sampling Check
      const eventHash = SamplingService.generateContentHash({
        traceId: data.traceId,
        eventType: data.eventType,
        userId: data.userId,
        parentStepId: data.parentStepId,
        content: data.content,
      });

      const samplingResult = await SamplingService.shouldSampleEvent(
        data.userId,
        data.environmentId,
        data.agentName,
        eventHash
      );

      if (!samplingResult.shouldSample) {
        logger.debug(
          {
            traceId: data.traceId,
            samplingRate: samplingResult.samplingRate,
            hashValue: samplingResult.hashValue,
          },
          'Event rejected by sampling'
        );

        return {
          id: null,
          status: 'sampled_out',
          message: samplingResult.reason,
        };
      }

      // 3. Idempotency Check
      const idempotencyKey = data.idempotencyKey || `hash_${eventHash}`;

      const existingEvent = await LLMEvent.findOne({
        where: {
          traceId: data.traceId,
          metadata: {
            [Op.contains]: { idempotencyKey },
          } as any,
        },
      });

      if (existingEvent) {
        logger.info(
          {
            traceId: data.traceId,
            idempotencyKey,
            existingEventId: existingEvent.id,
          },
          'Idempotent duplicate detected, skipping'
        );

        return {
          id: existingEvent.id,
          status: 'skipped',
          stepId: existingEvent.stepId,
          parentStepId: existingEvent.parentStepId,
          spanId: existingEvent.spanId,
          message: 'Event already exists (idempotency check)',
        };
      }

      // 4. Step Resolution
      const { stepId, parentStepId, spanId } = await this.resolveStepInfo(
        data.traceId,
        data.stepId,
        data.parentStepId,
        data.spanId
      );

      // 5. For tool_call events, create tool_call_request and tool_call_response instead
      if (data.eventType === 'tool_call') {
        const result = await this.createToolCallEvents({
          traceId: data.traceId,
          userId: data.userId,
          providerId: data.providerId,
          currentStepId: stepId,
          parentStepId,
          currentTimestamp: data.timestamp,
          content: data.content,
          metadata: data.metadata,
          idempotencyKey,
        });

        return {
          id: result.requestEventId,
          status: 'saved',
          stepId: result.requestStepId,
          parentStepId: result.parentStepId,
          spanId: result.spanId,
        };
      }

      // 6. Create Event (for non-tool_call events)
      const finalMetadata = {
        ...(data.metadata || {}),
        idempotencyKey,
      };

      const event = await LLMEvent.create({
        eventType: data.eventType,
        traceId: data.traceId,
        stepId,
        parentStepId,
        spanId,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        content: data.content,
        metadata: finalMetadata,
        userId: data.userId,
        providerId: data.providerId,
      });

      logger.info(
        {
          eventId: event.id,
          traceId: data.traceId,
          stepId,
          eventType: data.eventType,
          spanId,
        },
        'Event saved'
      );

      return {
        id: event.id,
        status: 'saved',
        stepId,
        parentStepId,
        spanId,
      };
    });
  }

  /**
   * Process multiple events in batch
   */
  static async processBatchEvents(events: EventData[]): Promise<EventProcessResult[]> {
    return Promise.all(events.map((event) => this.processEvent(event)));
  }

  /**
   * List events with filters and pagination
   */
  static async listEvents(filters: EventListFilters) {
    const { traceId, userId, providerId, limit = 100, offset = 0 } = filters;

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

    return {
      events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Get event by ID
   */
  static async getEventById(id: string): Promise<LLMEvent | null> {
    return LLMEvent.findByPk(id);
  }

  /**
   * Create tool_call_request and tool_call_response events when tool_call event is received
   * tool_call_request gets the timestamp of the previous event
   * tool_call_response gets the current timestamp
   * Returns the created event info
   */
  private static async createToolCallEvents(data: {
    traceId: string;
    userId: string;
    providerId?: string;
    currentStepId: number;
    parentStepId?: number;
    currentTimestamp?: string;
    content: any;
    metadata?: Record<string, any>;
    idempotencyKey: string;
  }): Promise<{
    requestEventId: string;
    responseEventId: string;
    requestStepId: number;
    parentStepId: number | undefined;
    spanId: string;
  }> {
    // Get the previous event to use its timestamp for tool_call_request
    const previousEvent = await LLMEvent.findOne({
      where: { 
        traceId: data.traceId,
        stepId: { [Op.lt]: data.currentStepId },
      },
      order: [['stepId', 'DESC']],
    });

    const requestTimestamp = previousEvent?.timestamp || new Date();
    const responseTimestamp = data.currentTimestamp ? new Date(data.currentTimestamp) : new Date();
    const parentStepId = data.parentStepId || previousEvent?.stepId || data.currentStepId - 1;

    const toolCalls = data.content?.toolCalls || data.content?.tool_calls || [];
    const toolResults = data.content?.toolResults || data.content?.tool_results || data.content?.result;

    const spanId = `span_${nanoid()}`;

    // Create tool_call_request event with previous event's timestamp
    const toolCallRequestEvent = await LLMEvent.create({
      eventType: 'tool_call_request',
      traceId: data.traceId,
      stepId: data.currentStepId,
      parentStepId,
      spanId,
      timestamp: requestTimestamp,
      content: {
        toolCalls,
        requestedAt: requestTimestamp.toISOString(),
      },
      metadata: {
        ...data.metadata,
        autoGenerated: true,
        toolCallCount: toolCalls.length,
        idempotencyKey: `${data.idempotencyKey}_request`,
      },
      userId: data.userId,
      providerId: data.providerId,
    });

    logger.info(
      {
        eventId: toolCallRequestEvent.id,
        traceId: data.traceId,
        stepId: data.currentStepId,
        parentStepId,
        toolCallCount: toolCalls.length,
        requestTimestamp: requestTimestamp.toISOString(),
      },
      'Tool call request event created'
    );

    // Create tool_call_response event with current timestamp
    const toolCallResponseEvent = await LLMEvent.create({
      eventType: 'tool_call_response',
      traceId: data.traceId,
      stepId: data.currentStepId + 1,
      parentStepId: data.currentStepId,
      spanId,
      timestamp: responseTimestamp,
      content: {
        toolCalls,
        toolResults,
        respondedAt: responseTimestamp.toISOString(),
      },
      metadata: {
        ...data.metadata,
        autoGenerated: true,
        toolCallCount: toolCalls.length,
        latencyMs: responseTimestamp.getTime() - requestTimestamp.getTime(),
        idempotencyKey: `${data.idempotencyKey}_response`,
      },
      userId: data.userId,
      providerId: data.providerId,
    });

    logger.info(
      {
        eventId: toolCallResponseEvent.id,
        traceId: data.traceId,
        stepId: data.currentStepId + 1,
        parentStepId: data.currentStepId,
        toolCallCount: toolCalls.length,
        responseTimestamp: responseTimestamp.toISOString(),
        latencyMs: responseTimestamp.getTime() - requestTimestamp.getTime(),
      },
      'Tool call response event created'
    );

    return {
      requestEventId: toolCallRequestEvent.id,
      responseEventId: toolCallResponseEvent.id,
      requestStepId: data.currentStepId,
      parentStepId,
      spanId,
    };
  }

  /**
   * Resolve step information for an event
   */
  private static async resolveStepInfo(
    traceId: string,
    stepId?: number,
    parentStepId?: number,
    spanId?: string
  ): Promise<{ stepId: number; parentStepId?: number; spanId: string }> {
    let resolvedStepId = stepId;
    let resolvedParentStepId = parentStepId;
    const resolvedSpanId = spanId || `span_${nanoid()}`;

    if (!resolvedStepId) {
      const lastEvent = await LLMEvent.findOne({
        where: { traceId },
        order: [['stepId', 'DESC']],
      });

      if (lastEvent) {
        resolvedStepId = lastEvent.stepId + 1;
        resolvedParentStepId = lastEvent.stepId;
      } else {
        resolvedStepId = 1;
        resolvedParentStepId = undefined;
      }
    } else if (!resolvedParentStepId && resolvedStepId > 1) {
      resolvedParentStepId = resolvedStepId - 1;
    }

    return {
      stepId: resolvedStepId,
      parentStepId: resolvedParentStepId,
      spanId: resolvedSpanId,
    };
  }
}
