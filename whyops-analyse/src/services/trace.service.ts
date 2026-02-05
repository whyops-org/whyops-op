import { createServiceLogger } from '@whyops/shared/logger';
import { Provider, Trace } from '@whyops/shared/models';
import { ParserFactory } from '../parsers';
import { EntityService } from './entity.service';

const logger = createServiceLogger('analyse:trace-service');

export interface TraceCreationData {
  traceId: string;
  userId: string;
  providerId: string;
  entityName?: string;
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
    try {
      // 1. Check if trace exists first (fast path)
      let trace = await Trace.findByPk(data.traceId);
      if (trace) {
        // Trace already exists, locked to an Entity Version
        return trace;
      }

      // 2. Resolve Entity ID (if name provided)
      // This will create the entity if it doesn't exist
      let resolvedEntityId: string | undefined;
      if (data.entityName) {
        resolvedEntityId = await EntityService.resolveEntityId(
          data.userId,
          data.entityName,
          data.metadata // Pass metadata to create/version the entity
        );
      }

      // 3. Resolve Provider Type to select parser
      let providerType = 'openai'; // default
      try {
        const provider = await Provider.findByPk(data.providerId);
        if (provider) providerType = provider.type;
      } catch (e) {
        logger.warn(
          { providerId: data.providerId },
          'Failed to fetch provider type for trace init, using default'
        );
      }

      // 4. Extract Metadata using Strategy Pattern
      const parser = ParserFactory.getParser(providerType);
      const metadata = parser.extract(data.content, data.metadata);

      // 5. Create Trace (using findOrCreate for safety)
      const [newTrace, created] = await Trace.findOrCreate({
        where: { id: data.traceId },
        defaults: {
          id: data.traceId,
          userId: data.userId,
          providerId: data.providerId,
          entityId: resolvedEntityId,
          model: metadata.model,
          systemMessage: metadata.systemMessage,
          tools: metadata.tools,
          metadata: data.metadata,
          createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
        },
      });

      if (created) {
        logger.info(
          { traceId: newTrace.id, providerType, entityId: resolvedEntityId },
          'Trace initialized'
        );
      }

      return newTrace;
    } catch (error) {
      logger.error({ error, traceId: data.traceId }, 'Failed to ensure trace existence');
      return null;
    }
  }
}
