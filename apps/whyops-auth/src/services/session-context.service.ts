import { createServiceLogger } from '@whyops/shared/logger';
import type { SessionAuthContext } from '@whyops/shared/middleware';
import { ApiKey, Environment, Project, Provider } from '@whyops/shared/models';
import {
  cacheSessionAuthContext,
  cacheSingleActiveProvider,
  getCachedSessionAuthContext,
  getCachedSingleActiveProvider,
} from '@whyops/shared/services';
import { QueryTypes } from 'sequelize';

const logger = createServiceLogger('auth:session-context-service');

interface PrimarySessionContextRow {
  projectId: string;
  environmentId: string;
  providerId: string | null;
}

async function resolveSingleActiveProviderId(userId: string): Promise<string | undefined> {
  const cached = await getCachedSingleActiveProvider<{ id: string }>(userId);
  if (cached.hit) {
    return cached.provider?.id;
  }

  const providers = await Provider.findAll({
    where: {
      userId,
      isActive: true,
    },
    attributes: ['id'],
    order: [['createdAt', 'ASC']],
    limit: 2,
  });

  const providerId = providers.length === 1 ? providers[0]?.id : undefined;
  await cacheSingleActiveProvider(userId, providerId ? { id: providerId } : null);
  return providerId;
}

export class SessionContextService {
  static async getSessionAuthContext(userId: string): Promise<SessionAuthContext | null> {
    const cached = await getCachedSessionAuthContext(userId);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const rows = await ApiKey.sequelize!.query<PrimarySessionContextRow>(
        `
          SELECT
            ak.project_id AS "projectId",
            ak.environment_id AS "environmentId",
            ak.provider_id AS "providerId"
          FROM api_keys ak
          JOIN projects p
            ON p.id = ak.project_id
           AND p.is_active = true
          JOIN environments e
            ON e.id = ak.environment_id
           AND e.is_active = true
          WHERE ak.user_id = :userId
            AND ak.is_master = true
            AND ak.is_active = true
          ORDER BY ak.last_used_at DESC NULLS LAST, ak.created_at DESC
          LIMIT 1
        `,
        {
          replacements: { userId },
          type: QueryTypes.SELECT,
        }
      );

      let projectId: string | null = rows[0]?.projectId ?? null;
      let environmentId: string | null = rows[0]?.environmentId ?? null;
      let providerId = rows[0]?.providerId ?? undefined;

      if (!projectId) {
        const project = await Project.findOne({
          where: { userId, isActive: true },
          attributes: ['id'],
          order: [['createdAt', 'ASC']],
        });
        projectId = project?.id ?? null;
      }

      if (!environmentId && projectId) {
        const environment = await Environment.findOne({
          where: { projectId, isActive: true },
          attributes: ['id'],
          order: [['createdAt', 'ASC']],
        });
        environmentId = environment?.id ?? null;
      }

      if (!projectId || !environmentId) {
        await cacheSessionAuthContext(userId, null);
        return null;
      }

      if (!providerId) {
        providerId = await resolveSingleActiveProviderId(userId);
      }

      const context: SessionAuthContext = {
        authType: 'session',
        userId,
        projectId,
        environmentId,
        providerId,
        isMaster: true,
        sessionId: '',
        userEmail: '',
        userName: null,
      };

      await cacheSessionAuthContext(userId, context);
      return context;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to resolve session auth context');
      return null;
    }
  }
}
