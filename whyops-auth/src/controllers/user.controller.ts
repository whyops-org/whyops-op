import { createServiceLogger } from '@whyops/shared/logger';
import { Context } from 'hono';
import { auth } from '../lib/auth';
import { ProviderService, ProjectService } from '../services';
import { UserService } from '../services';
import { ResponseUtil } from '../utils';

const logger = createServiceLogger('auth:user-controller');

export interface OnboardingProgress {
  hasProvider: boolean;
  hasProject: boolean;
  onboardingComplete: boolean;
  currentStep: 'welcome' | 'provider' | 'workspace' | 'complete';
}

export class UserController {
  /**
   * Get onboarding progress for the current user
   */
  static async getOnboardingProgress(c: Context) {
    try {
      const user = c.get('user');

      if (!user) {
        return ResponseUtil.unauthorized(c, 'Not authenticated');
      }

      // Check if user has providers
      const providers = await ProviderService.listProviders(user.id);
      const hasProvider = providers.length > 0;

      // Check if user has projects
      const projects = await ProjectService.listProjects(user.id);
      const hasProject = projects.length > 0;

      // Determine current onboarding step
      let currentStep: OnboardingProgress['currentStep'] = 'welcome';
      if (!hasProvider) {
        currentStep = 'provider';
      } else if (!hasProject) {
        currentStep = 'workspace';
      } else if (!user.metadata?.onboardingComplete) {
        currentStep = 'complete';
      }

      const onboardingComplete = Boolean(user.metadata?.onboardingComplete);

      return ResponseUtil.success(c, {
        hasProvider,
        hasProject,
        onboardingComplete,
        currentStep: hasProvider && hasProject && onboardingComplete ? 'complete' : currentStep,
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch onboarding progress');
      return ResponseUtil.internalError(c, 'Failed to fetch onboarding progress');
    }
  }

  /**
   * Get current user profile
   */
  static async getCurrentUser(c: Context) {
    try {
      const user = c.get('user');

      if (!user) {
        return ResponseUtil.unauthorized(c, 'Not authenticated');
      }

      return ResponseUtil.success(c, {
        id: user.id,
        email: user.email,
        name: user.name,
        metadata: user.metadata,
        onboardingComplete: Boolean(user.metadata?.onboardingComplete),
        isActive: user.isActive,
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
      const user = c.get('user');

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
          metadata: {
            onboardingComplete: data.onboardingComplete,
          },
        });
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
