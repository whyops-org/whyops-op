import { createServiceLogger } from '@whyops/shared/logger';
import { Provider } from '@whyops/shared/models';
import { encrypt } from '../utils/crypto.util';

const logger = createServiceLogger('auth:provider-service');

/**
 * Generate a URL-friendly slug from a provider name
 * - Convert to lowercase
 * - Remove special characters
 * - Replace spaces with hyphens
 * - Remove duplicate hyphens
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove duplicate hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

export interface CreateProviderData {
  userId: string;
  name: string;
  slug: string;
  type: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  metadata?: Record<string, any>;
}

export interface UpdateProviderData {
  name?: string;
  slug?: string;
  baseUrl?: string;
  apiKey?: string;
  metadata?: Record<string, any>;
}

export class ProviderService {
  /**
   * Fast existence check used by onboarding status endpoints.
   */
  static async hasProviders(userId: string): Promise<boolean> {
    try {
      const provider = await Provider.findOne({
        where: { userId, isActive: true },
        attributes: ['id'],
      });
      return Boolean(provider);
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code;
      if (code === '42P01') {
        logger.warn({ userId }, 'providers table missing; treating provider existence as false');
        return false;
      }
      throw error;
    }
  }

  /**
   * List all providers for a user
   */
  static async listProviders(userId: string): Promise<Provider[]> {
    try {
      const providers = await Provider.findAll({
        where: { userId },
        attributes: { exclude: ['apiKey'] },
      });

      return providers;
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code;
      if (code === '42P01') {
        logger.warn({ userId }, 'providers table missing; returning empty provider list');
        return [];
      }
      throw error;
    }
  }

  /**
   * Get provider by ID
   */
  static async getProviderById(providerId: string, userId: string): Promise<Provider | null> {
    const provider = await Provider.findOne({
      where: { id: providerId, userId },
      attributes: { exclude: ['apiKey'] },
    });

    return provider;
  }

  /**
   * Test provider connection before creating
   */
  static async testProviderConnection(
    type: 'openai' | 'anthropic',
    baseUrl: string,
    apiKey: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (type === 'openai') {
        const response = await fetch(`${baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          return { success: false, message: `Failed to connect: ${response.statusText}` };
        }
        return { success: true, message: 'Successfully connected to OpenAI' };
      } else if (type === 'anthropic') {
        const response = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          return { success: false, message: `Failed to connect: ${response.statusText}` };
        }
        return { success: true, message: 'Successfully connected to Anthropic' };
      }

      return { success: false, message: 'Unsupported provider type' };
    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
        return { success: false, message: 'Connection timeout - check base URL' };
      } else if (error.cause?.code === 'ENOTFOUND') {
        return { success: false, message: 'Invalid base URL - host not found' };
      }
      return { success: false, message: error.message || 'Connection test failed' };
    }
  }

  /**
   * Create a new provider
   */
  static async createProvider(data: CreateProviderData): Promise<Provider> {
    // Check for duplicate provider slug for this user
    const existing = await Provider.findOne({
      where: { userId: data.userId, slug: data.slug },
    });

    if (existing) {
      throw new Error('A provider with this name already exists');
    }

    // Test connection before creating provider
    // const testResult = await this.testProviderConnection(data.type, data.baseUrl, data.apiKey);
    // if (!testResult.success) {
    //   throw new Error(`Connection failed: ${testResult.message}`);
    // }

    const provider = await Provider.create({
      userId: data.userId,
      name: data.name,
      slug: data.slug,
      type: data.type,
      baseUrl: data.baseUrl,
      apiKey: encrypt(data.apiKey),
      metadata: data.metadata,
      isActive: true,
    });

    logger.info(
      { providerId: provider.id, userId: data.userId, type: data.type },
      'Provider created'
    );

    return provider;
  }

  /**
   * Update provider
   */
  static async updateProvider(
    providerId: string,
    userId: string,
    data: UpdateProviderData
  ): Promise<Provider> {
    const provider = await Provider.findOne({
      where: { id: providerId, userId },
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Update fields
    if (data.name !== undefined) provider.name = data.name;
    if (data.baseUrl !== undefined) provider.baseUrl = data.baseUrl;
    if (data.apiKey !== undefined) provider.apiKey = encrypt(data.apiKey);
    if (data.metadata !== undefined) provider.metadata = data.metadata;

    await provider.save();

    logger.info({ providerId, userId }, 'Provider updated');

    return provider;
  }

  /**
   * Delete provider
   */
  static async deleteProvider(providerId: string, userId: string): Promise<void> {
    const provider = await Provider.findOne({
      where: { id: providerId, userId },
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    await provider.destroy();

    logger.info({ providerId, userId }, 'Provider deleted');
  }

  /**
   * Toggle provider active status
   */
  static async toggleProvider(providerId: string, userId: string): Promise<boolean> {
    const provider = await Provider.findOne({
      where: { id: providerId, userId },
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    provider.isActive = !provider.isActive;
    await provider.save();

    logger.info({ providerId, isActive: provider.isActive }, 'Provider toggled');

    return provider.isActive;
  }
}
