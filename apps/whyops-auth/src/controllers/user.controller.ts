import { createServiceLogger } from '@whyops/shared/logger';
import { Context } from 'hono';
import { auth } from '../lib/auth';
import { ProviderService, ProjectService } from '../services';
import { UserService } from '../services';
import { ResponseUtil } from '../utils';

const logger = createServiceLogger('auth:user-controller');
const ONBOARDING_CACHE_TTL_MS = 15_000;
const onboardingProgressCache = new Map<string, { expiresAtMs: number; value: OnboardingProgress }>();

export interface OnboardingProgress {
  hasProvider: boolean;
  hasProject: boolean;
  onboardingComplete: boolean;
  currentStep: 'welcome' | 'workspace' | 'complete';
}

export class UserController {
  private static async getUserOnboardingState(userId: string): Promise<boolean> {
    const appUser = await UserService.getUserById(userId);
    return Boolean(appUser?.metadata?.onboardingComplete);
  }

  /**
   * Get onboarding progress for the current user
   */
  static async getOnboardingProgress(c: Context) {
    try {
      const user = c.get('sessionUser');

      if (!user) {
        return ResponseUtil.unauthorized(c, 'Not authenticated');
      }

      const onboardingComplete = await UserController.getUserOnboardingState(user.id);
      const cacheKey = `${user.id}:${onboardingComplete ? '1' : '0'}`;
      const cached = onboardingProgressCache.get(cacheKey);
      if (cached && Date.now() <= cached.expiresAtMs) {
        return ResponseUtil.success(c, cached.value);
      }

      // Fast existence checks, executed in parallel.
      const [hasProvider, hasProject] = await Promise.all([
        ProviderService.hasProviders(user.id),
        ProjectService.hasProjects(user.id),
      ]);

      // Provider setup is optional because users can ingest manual events directly.
      let currentStep: OnboardingProgress['currentStep'] = 'welcome';
      if (!hasProject) {
        currentStep = 'workspace';
      } else if (!onboardingComplete) {
        currentStep = 'complete';
      }

      const payload: OnboardingProgress = {
        hasProvider,
        hasProject,
        onboardingComplete,
        currentStep: onboardingComplete ? 'complete' : currentStep,
      };

      onboardingProgressCache.set(cacheKey, {
        expiresAtMs: Date.now() + ONBOARDING_CACHE_TTL_MS,
        value: payload,
      });

      return ResponseUtil.success(c, payload);
    } catch (error: any) {
      logger.error(
        {
          error: error?.message || error,
          stack: error?.stack,
        },
        'Failed to fetch onboarding progress'
      );
      return ResponseUtil.internalError(c, 'Failed to fetch onboarding progress');
    }
  }

  /**
   * Get current user profile
   */
  static async getCurrentUser(c: Context) {
    try {
      const user = c.get('sessionUser');

      if (!user) {
        return ResponseUtil.unauthorized(c, 'Not authenticated');
      }

      const appUser = await UserService.getUserById(user.id);
      const metadata = (appUser?.metadata || user.metadata || {}) as Record<string, any>;
      const onboardingComplete = Boolean(metadata?.onboardingComplete);

      return ResponseUtil.success(c, {
        id: user.id,
        email: user.email,
        name: appUser?.name ?? user.name,
        metadata,
        onboardingComplete,
        isActive: appUser?.isActive ?? user.isActive,
        permissions: {
          canChangeAgentMaxTraces: Boolean(metadata?.canChangeAgentMaxTraces),
          canChangeAgentMaxSpans: Boolean(metadata?.canChangeAgentMaxSpans),
          canChangeMaxAgents: Boolean(metadata?.canChangeMaxAgents),
        },
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch user');
      return ResponseUtil.internalError(c, 'Failed to fetch user');
    }
  }

  /**
   * Update current user profile
   */
  static async updateCurrentUser(c: Context) {
    try {
      const user = c.get('sessionUser');

      if (!user) {
        return ResponseUtil.unauthorized(c, 'Not authenticated');
      }

      const data = await c.req.json();

      // Only call Better Auth's update user API if there's name or image to update
      if (data.name !== undefined || data.image !== undefined) {
        await auth.api.updateUser({
          headers: c.req.raw.headers,
          body: {
            name: data.name,
            image: data.image,
          },
        });
      }

      // Update onboarding complete in our database
      if (typeof data.onboardingComplete === 'boolean') {
        await UserService.updateUser(user.id, {
          onboardingComplete: data.onboardingComplete,
        });
        onboardingProgressCache.delete(`${user.id}:0`);
        onboardingProgressCache.delete(`${user.id}:1`);
      }

      return ResponseUtil.success(c, {
        message: 'User updated successfully',
      });
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to update user');
      return ResponseUtil.internalError(c, `Failed to update user: ${error.message}`);
    }
  }
}
