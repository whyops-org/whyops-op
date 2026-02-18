import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import { ApiKey, Entity, Environment, Project, Provider } from '@whyops/shared/models';
import { hashApiKey } from '@whyops/shared/utils';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import type { ApiKeyAuthContext, SessionAuthContext, SessionUser, UserSession } from './types';

const logger = createServiceLogger('auth:utils');

export interface BetterAuthSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    image?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}

export async function getSessionFromAuthServer(headers: Headers): Promise<BetterAuthSession | null> {
  const authUrl = env.AUTH_URL.replace(/\/$/, '');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${authUrl}/api/auth/get-session`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json() as BetterAuthSession | null;
      return data;
    }
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    logger.warn({ error, authUrl }, 'Failed to fetch session from auth service');
    return null;
  }
}

export async function getSessionFromCookie(c: Context): Promise<BetterAuthSession | null> {
  const sessionToken = getCookie(c, 'better-auth.session_token');
  
  if (!sessionToken) {
    return null;
  }

  const headers = new Headers({
    'Cookie': `better-auth.session_token=${sessionToken}`,
    'Content-Type': 'application/json',
  });

  return getSessionFromAuthServer(headers);
}

export async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; context?: ApiKeyAuthContext; error?: string }> {
  const isYopsKey = apiKey.startsWith('YOPS-');
  const isWhyopsKey = apiKey.startsWith('whyops_');

  if (!isYopsKey && !isWhyopsKey) {
    return { valid: false, error: 'Invalid API key format' };
  }

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
        { model: Entity, as: 'entity', required: false },
      ],
    });

    if (!apiKeyRecord) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      return { valid: false, error: 'API key expired' };
    }

    const project = (apiKeyRecord as any).project;
    const environment = (apiKeyRecord as any).environment;

    if (!project?.isActive) {
      return { valid: false, error: 'Project is not active' };
    }

    if (!environment?.isActive) {
      return { valid: false, error: 'Environment is not active' };
    }

    ApiKey.update(
      { lastUsedAt: new Date() },
      { where: { id: apiKeyRecord.id } }
    ).catch((err) => logger.error({ err }, 'Failed to update lastUsedAt'));

    return {
      valid: true,
      context: {
        authType: 'api_key',
        apiKey,
        userId: apiKeyRecord.userId,
        projectId: apiKeyRecord.projectId,
        environmentId: apiKeyRecord.environmentId,
        providerId: apiKeyRecord.providerId ?? undefined,
        entityId: apiKeyRecord.entityId ?? undefined,
        isMaster: apiKeyRecord.isMaster,
        apiKeyId: apiKeyRecord.id,
        apiKeyPrefix: apiKeyRecord.keyPrefix,
        environmentName: environment.name,
        project,
        environment,
        provider: (apiKeyRecord as any).provider,
        entity: (apiKeyRecord as any).entity,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Failed to validate API key');
    return { valid: false, error: 'Internal server error' };
  }
}

export async function getSessionAuthContext(
  userId: string
): Promise<SessionAuthContext | null> {
  try {
    const project = await Project.findOne({
      where: { userId, isActive: true },
      order: [['createdAt', 'ASC']],
    });

    if (!project) {
      return null;
    }

    const environment = await Environment.findOne({
      where: { projectId: project.id },
      order: [['createdAt', 'ASC']],
    });

    if (!environment) {
      return null;
    }

    const apiKeyRecord = await ApiKey.findOne({
      where: {
        userId,
        projectId: project.id,
        environmentId: environment.id,
        isMaster: true,
        isActive: true,
      },
      include: [{ model: Provider, as: 'provider', required: false }],
    });

    return {
      authType: 'session',
      userId,
      projectId: project.id,
      environmentId: environment.id,
      providerId: apiKeyRecord?.providerId ?? undefined,
      isMaster: true,
      sessionId: '',
      userEmail: '',
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get session auth context');
    return null;
  }
}

export async function loadUserSession(c: Context): Promise<{ user: SessionUser; session: UserSession['session'] } | null> {
  const sessionData = await getSessionFromCookie(c);
  
  if (!sessionData) {
    return null;
  }

  try {
    const { User } = await import('@whyops/shared/models');
    const appUser = await User.findByPk(sessionData.user.id);

    if (appUser) {
      const mergedUser: SessionUser = {
        id: sessionData.user.id,
        email: sessionData.user.email,
        name: sessionData.user.name,
        metadata: appUser.metadata,
        onboardingComplete: Boolean(appUser.metadata?.onboardingComplete),
        isActive: appUser.isActive,
      };
      return { user: mergedUser, session: sessionData.session };
    }

    return {
      user: sessionData.user as SessionUser,
      session: sessionData.session,
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to load Sequelize user data, using Better Auth user');
    return {
      user: sessionData.user as SessionUser,
      session: sessionData.session,
    };
  }
}

export async function loadUserSessionFromBetterAuth(
  session: BetterAuthSession | null
): Promise<{ user: SessionUser; session: UserSession['session'] } | null> {
  if (!session) {
    return null;
  }

  try {
    const { User } = await import('@whyops/shared/models');
    const appUser = await User.findByPk(session.user.id);

    if (appUser) {
      const mergedUser: SessionUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        metadata: appUser.metadata,
        onboardingComplete: Boolean(appUser.metadata?.onboardingComplete),
        isActive: appUser.isActive,
      };
      return { user: mergedUser, session: session.session };
    }

    return {
      user: session.user as SessionUser,
      session: session.session,
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to load Sequelize user data, using Better Auth user');
    return {
      user: session.user as SessionUser,
      session: session.session,
    };
  }
}
