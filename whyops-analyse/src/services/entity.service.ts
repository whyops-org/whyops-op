import { createServiceLogger } from '@whyops/shared/logger';
import { Entity } from '@whyops/shared/models';
import { createHash } from 'crypto';

const logger = createServiceLogger('analyse:entity-service');

export class EntityService {
  /**
   * Creates a hash for entity metadata to detect configuration changes
   */
  private static createMetadataHash(metadata: Record<string, any>): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(metadata));
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Resolves entity ID by user ID and entity name
   * Creates the entity if it doesn't exist
   * Returns the latest version of the entity (or creates a new version if metadata changed)
   */
  static async resolveEntityId(
    userId: string,
    entityName?: string,
    metadata?: Record<string, any>
  ): Promise<string | undefined> {
    if (!entityName) return undefined;

    try {
      // Find existing entity by userId and name (get latest version)
      const existingEntity = await Entity.findOne({
        where: { userId, name: entityName },
        order: [['createdAt', 'DESC']],
      });

      // If entity exists, check if metadata changed (creating a new version)
      if (existingEntity) {
        const currentHash = this.createMetadataHash(metadata || {});
        
        // If hash matches, return existing entity
        if (existingEntity.hash === currentHash) {
          return existingEntity.id;
        }
        
        // Metadata changed - create new version
        logger.info(
          { userId, entityName, oldHash: existingEntity.hash, newHash: currentHash },
          'Entity metadata changed, creating new version'
        );
      }

      // Create new entity (first time or new version)
      const hash = this.createMetadataHash(metadata || {});
      const newEntity = await Entity.create({
        userId,
        name: entityName,
        hash,
        metadata: metadata || {},
        samplingRate: 1.0, // Default sampling rate
      });

      logger.info(
        { entityId: newEntity.id, userId, entityName, isFirstVersion: !existingEntity },
        'Entity created'
      );

      return newEntity.id;
    } catch (error) {
      logger.error({ error, userId, entityName }, 'Failed to resolve entity ID');
      return undefined;
    }
  }

  /**
   * Gets entity by user ID and name (latest version)
   */
  static async getEntity(
    userId: string,
    entityName: string
  ): Promise<Entity | null> {
    try {
      return await Entity.findOne({
        where: { userId, name: entityName },
        order: [['createdAt', 'DESC']],
      });
    } catch (error) {
      logger.error({ error, userId, entityName }, 'Failed to get entity');
      return null;
    }
  }

  /**
   * Gets or creates an entity by user ID and name
   * This ensures the entity exists, creating it if necessary
   */
  static async getOrCreateEntity(
    userId: string,
    entityName: string,
    metadata?: Record<string, any>
  ): Promise<Entity | null> {
    try {
      const entityId = await this.resolveEntityId(userId, entityName, metadata);
      if (!entityId) return null;

      return await Entity.findByPk(entityId);
    } catch (error) {
      logger.error({ error, userId, entityName }, 'Failed to get or create entity');
      return null;
    }
  }
}
