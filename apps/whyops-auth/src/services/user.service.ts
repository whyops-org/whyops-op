import { createServiceLogger } from '@whyops/shared/logger';
import { User } from '@whyops/shared/models';

const logger = createServiceLogger('auth:user-service');

export interface UpdateUserData {
  name?: string;
  metadata?: Record<string, any>;
  onboardingComplete?: boolean;
}

export class UserService {
  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['passwordHash'] },
    });

    return user;
  }

  /**
   * Update user profile
   */
  static async updateUser(userId: string, data: UpdateUserData): Promise<User> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Update allowed fields
    if (data.name !== undefined) user.name = data.name;
    if (data.metadata !== undefined) user.metadata = data.metadata;
    if (data.onboardingComplete !== undefined) {
      const metadata = user.metadata ?? {};
      user.metadata = {
        ...metadata,
        onboardingComplete: data.onboardingComplete,
      };
    }

    await user.save();

    logger.info({ userId: user.id }, 'User updated');

    return user;
  }

  /**
   * Deactivate user account
   */
  static async deactivateUser(userId: string): Promise<void> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = false;
    await user.save();

    logger.info({ userId }, 'User deactivated');
  }
}
