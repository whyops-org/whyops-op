import { createServiceLogger } from '@whyops/shared/logger';
import { Provider, Trace } from '@whyops/shared/models';
import { upsertBlob } from '@whyops/shared/lib/content-blob';
import { ParserFactory } from '../parsers';
import { EntityService } from './entity.service';

const logger = createServiceLogger('analyse:trace-service');

export interface TraceCreationData {
  traceId: string;
  userId: string;
  externalUserId?: string;
  projectId: string;
  environmentId: string;
  providerId?: string;
  agentName: string;
  sampledIn?: boolean;
  content?: any;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export class TraceService {
  /**
   * Ensures a trace exists, creating it if necessary
   * Resolves entity and extracts metadata on first creation
   */
  static async ensureTraceExists(data: TraceCreationData): Promise<Trace | null> {
    // 1. Resolve agent version by name (auto-initialize if missing)
    let resolvedAgentVersion = await EntityService.resolveLatestAgentVersionByName(
      data.userId,
      data.projectId,
      data.environmentId,
      data.agentName
    );

    if (!resolvedAgentVersion) {
      logger.warn(
        {
          userId: data.userId,
          projectId: data.projectId,
          environmentId: data.environmentId,
          agentName: data.agentName,
        },
        'Agent not initialized; attempting auto-initialization from event payload'
      );

      await EntityService.initAgentVersion({
        userId: data.userId,
        projectId: data.projectId,
        environmentId: data.environmentId,
        agentName: data.agentName,
        metadata: this.extractInitMetadata(data.content, data.metadata),
      });

      resolvedAgentVersion = await EntityService.resolveLatestAgentVersionByName(
        data.userId,
        data.projectId,
        data.environmentId,
        data.agentName
      );
    }

    if (!resolvedAgentVersion) {
      throw new Error(`Agent '${data.agentName}' is not initialized`);
    }

    // 2. Check if trace exists first (fast path)
    let trace = await Trace.findByPk(data.traceId);
    if (trace) {
      if (trace.entityId && trace.entityId !== resolvedAgentVersion.agentVersionId) {
        throw new Error('TRACE_AGENT_CONFLICT');
      }

      if (!trace.entityId) {
        trace.entityId = resolvedAgentVersion.agentVersionId;
      }

      if (!trace.providerId && data.providerId) {
        trace.providerId = data.providerId;
      }

      if (trace.sampledIn === null || trace.sampledIn === undefined) {
        if (data.sampledIn !== null && data.sampledIn !== undefined) {
          trace.sampledIn = data.sampledIn;
        }
      }

      if (!trace.externalUserId && data.externalUserId) {
        trace.externalUserId = data.externalUserId;
      }

      const fallbackMetadata = this.extractBestEffortMetadata(data.content, data.metadata);

      if (!trace.model && fallbackMetadata.model) {
        trace.model = fallbackMetadata.model;
      }

      if (!trace.systemMessage && fallbackMetadata.systemMessage) {
        trace.systemMessage = fallbackMetadata.systemMessage;
        trace.systemMessageHash = await upsertBlob(fallbackMetadata.systemMessage);
      }

      if (!trace.tools && fallbackMetadata.tools) {
        trace.tools = fallbackMetadata.tools;
        trace.toolsHash = await upsertBlob(JSON.stringify(fallbackMetadata.tools));
      }

      if (trace.changed()) {
        await trace.save();
      }

      return trace;
    }

    // 3. Resolve Provider Type to select parser (if providerId is provided)
    let providerType = 'openai'; // default
    if (data.providerId) {
      try {
        const provider = await Provider.findByPk(data.providerId);
        if (provider) providerType = provider.type;
      } catch (e) {
        logger.warn(
          { providerId: data.providerId },
          'Failed to fetch provider type for trace init, using default'
        );
      }
    }

    // 4. Extract Metadata using Strategy Pattern
    const parser = ParserFactory.getParser(providerType);
    const metadata = parser.extract(data.content, data.metadata);

    // Hash system message and tools for deduplication across traces
    const systemMessageHash = metadata.systemMessage ? await upsertBlob(metadata.systemMessage) : undefined;
    const toolsHash = metadata.tools ? await upsertBlob(JSON.stringify(metadata.tools)) : undefined;

    // 5. Create Trace (using findOrCreate for safety)
    const [newTrace, created] = await Trace.findOrCreate({
      where: { id: data.traceId },
      defaults: {
        id: data.traceId,
        userId: data.userId,
        externalUserId: data.externalUserId,
        providerId: data.providerId,
        entityId: resolvedAgentVersion.agentVersionId,
        sampledIn: data.sampledIn ?? true,
        model: metadata.model,
        systemMessage: metadata.systemMessage,
        systemMessageHash,
        tools: metadata.tools,
        toolsHash,
        metadata: data.metadata,
        createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
      },
    });

    if (created) {
      logger.info(
        { traceId: newTrace.id, providerType, entityId: resolvedAgentVersion.agentVersionId },
        'Trace initialized'
      );
    }

    return newTrace;
  }

  private static extractBestEffortMetadata(content?: any, metadata?: Record<string, any>) {
    const openai = ParserFactory.getParser('openai').extract(content, metadata);
    const anthropic = ParserFactory.getParser('anthropic').extract(content, metadata);

    return {
      model: openai.model || anthropic.model,
      systemMessage: openai.systemMessage || anthropic.systemMessage,
      tools: openai.tools || anthropic.tools,
    };
  }

  private static extractInitMetadata(content?: any, metadata?: Record<string, any>) {
    const fallbackMetadata = this.extractBestEffortMetadata(content, metadata);
    const systemPrompt =
      typeof metadata?.systemPrompt === 'string'
        ? metadata.systemPrompt
        : fallbackMetadata.systemMessage || '(Auto-initialized from ingested trace event)';
    const tools = Array.isArray(metadata?.tools)
      ? metadata.tools
      : Array.isArray(fallbackMetadata.tools)
        ? fallbackMetadata.tools
        : [];

    return {
      systemPrompt,
      tools,
      description: 'Auto-initialized by analyse service from first ingested trace event',
    };
  }
}
