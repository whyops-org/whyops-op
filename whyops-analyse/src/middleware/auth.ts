import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import { ApiKey, Environment, Project, Provider } from '@whyops/shared/models';
import { hashApiKey } from '@whyops/shared/utils';
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';

const logger = createServiceLogger('analyse:auth');

export interface AnalyseAuthContext {
  userId: string;
  projectId: string;
  environmentId: string;
  providerId?: string;
  isMaster: boolean;
}

declare module 'hono' {
  interface ContextVariableMap {
    analyseAuth: AnalyseAuthContext;
  }
}

/**
 * Auth middleware for analyse service
 * Supports both API key and session-based authentication
 */
export async function analyseAuthMiddleware(c: Context, next: Next) {
  if (c.get('analyseAuth')) {
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  const xApiKeyHeader = c.req.header('X-API-Key') ?? c.req.header('x-api-key');

  let apiKey: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7).trim();
  } else if (xApiKeyHeader) {
    apiKey = xApiKeyHeader.trim();
  }

  // First try API key auth (Authorization: Bearer ... or X-API-Key)
  if (apiKey) {

    try {
      const keyHash = hashApiKey(apiKey);

      const apiKeyRecord = await ApiKey.findOne({
        where: {
          keyHash,
          isActive: true,
        },
        include: [
          { model: Project, as: 'project', required: true },
          { model: Environment, as: 'environment', required: true },
          { model: Provider, as: 'provider', required: false },
        ],
      });

      if (apiKeyRecord) {
        c.set('analyseAuth', {
          userId: apiKeyRecord.userId,
          projectId: apiKeyRecord.projectId,
          environmentId: apiKeyRecord.environmentId,
          providerId: apiKeyRecord.providerId ?? undefined,
          isMaster: apiKeyRecord.isMaster,
        });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to validate API key');
    }
  }

  // If no API key auth, try session-based auth via Better Auth cookie
  if (!c.get('analyseAuth')) {
    try {
      let sessionUserId = c.get('sessionUserId');

      if (!sessionUserId) {
        const sessionToken = getCookie(c, 'better-auth.session_token');

        if (sessionToken) {
          const authUrl = env.AUTH_URL.replace(/\/$/, '');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          try {
            const response = await fetch(`${authUrl}/api/auth/get-session`, {
              method: 'GET',
              headers: {
                'Cookie': `better-auth.session_token=${sessionToken}`,
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json() as { user?: { id: string } };
              sessionUserId = data?.user?.id;

              if (sessionUserId) {
                c.set('sessionUserId', sessionUserId);
              }
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            logger.warn({ fetchError, authUrl }, 'Failed to fetch session from auth service');
          }
        }
      }

      if (sessionUserId) {
        const project = await Project.findOne({
          where: { userId: sessionUserId, isActive: true },
          order: [['createdAt', 'ASC']],
        });

        if (project) {
          const environment = await Environment.findOne({
            where: { projectId: project.id },
            order: [['createdAt', 'ASC']],
          });

          if (environment) {
            const apiKeyRecord = await ApiKey.findOne({
              where: {
                userId: sessionUserId,
                projectId: project.id,
                environmentId: environment.id,
                isMaster: true,
                isActive: true,
              },
              include: [{ model: Provider, as: 'provider', required: false }],
            });

            c.set('analyseAuth', {
              userId: sessionUserId,
              projectId: project.id,
              environmentId: environment.id,
              providerId: apiKeyRecord?.providerId ?? undefined,
              isMaster: true,
            });
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to validate session');
    }
  }

  await next();
}
