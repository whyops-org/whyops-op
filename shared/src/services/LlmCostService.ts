import { LlmCost } from '../models';
import { Op } from 'sequelize';
import sequelize from '../database';
import env from '../config/env';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('shared:llm-cost-service');

export class LlmCostService {
  private isMissingRelationError(error: any): boolean {
    return error?.name === 'SequelizeDatabaseError' && error?.original?.code === '42P01';
  }

  /**
   * Get cost for a single model or multiple models.
   * If not found or expired (TTL 2 months), fetches from Linkup API.
   */
  async getCosts(models: string | string[]) {
    const modelNames = Array.isArray(models) ? models : [models];
    const results: any[] = [];

    for (const name of modelNames) {
      const cost = await this.getCostForOne(name);
      if (cost) {
        results.push(cost);
      }
    }

    return Array.isArray(models) ? results : results[0];
  }

  private async getCostForOne(modelName: string) {
    // Basic normalization: remove spaces, lowercase
    const rawInput = modelName.trim().toLowerCase();

    // Derived normalized key: remove provider prefix if exists
    const normalizedName = rawInput.split('/').pop() || rawInput;
    
    // Aggressive alphanumeric fingerprint for robust matching
    // "qwen 3" -> "qwen3"
    // "qwen3-max" -> "qwen3max"
    const alphanumericQuery = rawInput.replace(/[^a-z0-9]/g, '');

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // 1. Search in DB with extension-free matching strategies.
    let cost: LlmCost | null = null;
    try {
      cost = await LlmCost.findOne({
        where: {
          [Op.or]: [
            // A. Exact normalized match
            { model: normalizedName },
            // B. Case-insensitive contains
            {
              model: {
                [Op.iLike]: `%${normalizedName}%`,
              },
            },
            // C. Aggressive alphanumeric fingerprint match
            sequelize.where(
              sequelize.fn('regexp_replace', sequelize.fn('lower', sequelize.col('model')), '[^a-z0-9]', '', 'g'),
              { [Op.like]: `%${alphanumericQuery}%` }
            ),
          ],
        },
        order: [[sequelize.fn('LENGTH', sequelize.col('model')), 'DESC']],
      });
    } catch (error: any) {
      if (this.isMissingRelationError(error)) {
        logger.warn({ modelName }, 'llm_costs table does not exist; skipping cost lookup');
        return null;
      }
      throw error;
    }

    // 2. Check if found and valid (TTL)
    if (cost && cost.updatedAt > twoMonthsAgo) {
      logger.info({ 
        modelName, 
        foundModel: cost.model, 
        similarity: 'fuzzy-match' 
      }, 'Cache HIT: LLM Cost found in DB');
      return cost;
    }

    logger.info({ modelName }, 'Cache MISS: Fetching LLM Cost from API');

    // 3. If not found or expired, fetch from external API
    try {
      const fetchedData = await this.fetchFromLinkup(modelName);

      if (fetchedData) {
        // Clean the fetched model name too
        const fetchedModelName = fetchedData.model.trim().toLowerCase();

        const contextWindow = typeof fetchedData.contextWindow === 'number' ? fetchedData.contextWindow : null;

        // If we found an expired record, update it
        if (cost) {
          logger.info({ modelName, fetchedModelName }, 'Updating expired LLM Cost record');
          await cost.update({
            inputTokenPricePerMillionToken: fetchedData.inputTokenPricePerMillionToken,
            outputTokenPricePerMillionToken: fetchedData.outputTokenPricePerMillionToken,
            cachedTokenPricePerMillionToken: fetchedData.cachedTokenPricePerMillionToken || 0,
            contextWindow,
            model: fetchedModelName,
          });
        } else {
          // Double check if we already have this exact model to prevent duplicates
          const existingCanonical = await LlmCost.findOne({ where: { model: fetchedModelName } });

          if (existingCanonical) {
            logger.info({ modelName, fetchedModelName }, 'Updating existing canonical LLM Cost record');
            await existingCanonical.update({
              inputTokenPricePerMillionToken: fetchedData.inputTokenPricePerMillionToken,
              outputTokenPricePerMillionToken: fetchedData.outputTokenPricePerMillionToken,
              cachedTokenPricePerMillionToken: fetchedData.cachedTokenPricePerMillionToken || 0,
              contextWindow,
            });
            cost = existingCanonical;
          } else {
            // Create new record
            logger.info({ modelName, fetchedModelName }, 'Creating new LLM Cost record');
            try {
              cost = await LlmCost.create({
                model: fetchedModelName,
                inputTokenPricePerMillionToken: fetchedData.inputTokenPricePerMillionToken,
                outputTokenPricePerMillionToken: fetchedData.outputTokenPricePerMillionToken,
                cachedTokenPricePerMillionToken: fetchedData.cachedTokenPricePerMillionToken || 0,
                contextWindow,
              });
            } catch (createError: any) {
              if (this.isMissingRelationError(createError)) {
                logger.warn({ modelName }, 'llm_costs table does not exist; returning fetched cost without persistence');
                return {
                  model: fetchedModelName,
                  inputTokenPricePerMillionToken: fetchedData.inputTokenPricePerMillionToken,
                  outputTokenPricePerMillionToken: fetchedData.outputTokenPricePerMillionToken,
                  cachedTokenPricePerMillionToken: fetchedData.cachedTokenPricePerMillionToken || 0,
                  contextWindow,
                };
              }
              throw createError;
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error, modelName }, 'Failed to fetch cost for model');
      // If API fails, return existing stale data if we have it
      if (cost) return cost;
      return null;
    }

    return cost;
  }

  private async fetchFromLinkup(query: string): Promise<any> {
    const url = "https://api.linkup.so/v1/search";
    const apiKey = env.LINKUP_API_KEY;
    if (!apiKey) {
      throw new Error('LINKUP_API_KEY environment variable is not set');
    }

    const payload = {
      q: `cost and context window of ${query}`,
      depth: "standard",
      outputType: "structured",
      includeImages: false,
      structuredOutputSchema: JSON.stringify({
        properties: {
          model: {
            description: "Model name key (base model name removing the provider such that it will remain same not considering the provider name, search on internet and give proper model key that is same all over the internet)",
            type: "string",
          },
          inputTokenPricePerMillionToken: {
            description: "input token price per million token in dollars",
            type: "number",
          },
          outputTokenPricePerMillionToken: {
            description: "output token price per million token in dollars",
            type: "number",
          },
          cachedTokenPricePerMillionToken: {
            description: "cached token price per million token in dollars",
            type: "number",
          },
          contextWindow: {
            description: "maximum context window size in tokens (e.g. 128000 for 128k context)",
            type: "number",
          },
        },
        type: "object",
      }),
      includeSources: false,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Linkup API error: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, any>;

    // Linkup structured output is nested under `output`
    const result = data?.output ?? data;

    // Validate that the response has the required pricing fields before returning
    if (
      typeof result?.inputTokenPricePerMillionToken !== 'number' ||
      typeof result?.outputTokenPricePerMillionToken !== 'number'
    ) {
      logger.warn({ modelName: query, rawResponse: data }, 'Linkup API returned unexpected structure; missing pricing fields');
      return null;
    }

    return result;
  }
}

export const llmCostService = new LlmCostService();
