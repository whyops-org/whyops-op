import { LlmCost } from '../models';
import { Op } from 'sequelize';
import sequelize from '../database';
import env from '../config/env';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('shared:llm-cost-service');

interface LinkupPricingResult {
  model: string;
  inputTokenPricePerMillionToken: number;
  outputTokenPricePerMillionToken: number;
  /** Cache hit (read) price per million tokens. */
  cacheReadTokenPricePerMillionToken?: number | null;
  /** 5-minute cache write price per million tokens. */
  cacheWrite5mTokenPricePerMillionToken?: number | null;
  /** 1-hour cache write price per million tokens. */
  cacheWrite1hTokenPricePerMillionToken?: number | null;
  contextWindow?: number | null;
}

export class LlmCostService {
  private isMissingRelationError(error: any): boolean {
    return error?.name === 'SequelizeDatabaseError' && error?.original?.code === '42P01';
  }

  private async findBestDbMatch(normalizedName: string, alphanumericQuery: string) {
    const exact = await LlmCost.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('model')), normalizedName),
    });
    if (exact) return exact;

    const exactAlphanumeric = await LlmCost.findOne({
      where: sequelize.where(
        sequelize.fn('regexp_replace', sequelize.fn('lower', sequelize.col('model')), '[^a-z0-9]', '', 'g'),
        alphanumericQuery,
      ),
    });
    if (exactAlphanumeric) return exactAlphanumeric;

    return LlmCost.findOne({
      where: {
        [Op.or]: [
          {
            model: {
              [Op.iLike]: `${normalizedName}%`,
            },
          },
          {
            model: {
              [Op.iLike]: `%${normalizedName}%`,
            },
          },
          sequelize.where(
            sequelize.fn('regexp_replace', sequelize.fn('lower', sequelize.col('model')), '[^a-z0-9]', '', 'g'),
            { [Op.like]: `%${alphanumericQuery}%` }
          ),
        ],
      },
      order: [[sequelize.fn('LENGTH', sequelize.col('model')), 'ASC']],
    });
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
    const rawInput = modelName.trim().toLowerCase();
    const normalizedName = rawInput.split('/').pop() || rawInput;
    const alphanumericQuery = rawInput.replace(/[^a-z0-9]/g, '');

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    let cost: LlmCost | null = null;
    try {
      cost = await this.findBestDbMatch(normalizedName, alphanumericQuery);
    } catch (error: any) {
      if (this.isMissingRelationError(error)) {
        logger.warn({ modelName }, 'llm_costs table does not exist; skipping cost lookup');
        return null;
      }
      throw error;
    }

    if (cost && cost.updatedAt > twoMonthsAgo) {
      logger.info({ modelName, foundModel: cost.model }, 'Cache HIT: LLM Cost found in DB');
      return cost;
    }

    logger.info({ modelName }, 'Cache MISS: Fetching LLM Cost from Linkup');

    try {
      const fetched = await this.fetchFromLinkup(modelName);

      if (fetched) {
        const fetchedModelName = fetched.model.trim().toLowerCase();
        const contextWindow = typeof fetched.contextWindow === 'number' ? fetched.contextWindow : null;

        const fields = {
          inputTokenPricePerMillionToken: fetched.inputTokenPricePerMillionToken,
          outputTokenPricePerMillionToken: fetched.outputTokenPricePerMillionToken,
          cacheReadTokenPricePerMillionToken: fetched.cacheReadTokenPricePerMillionToken ?? 0,
          cacheWrite5mTokenPricePerMillionToken: fetched.cacheWrite5mTokenPricePerMillionToken ?? null,
          cacheWrite1hTokenPricePerMillionToken: fetched.cacheWrite1hTokenPricePerMillionToken ?? null,
          contextWindow,
        };

        if (cost) {
          logger.info({ modelName, fetchedModelName }, 'Updating expired LLM Cost record');
          await cost.update({ ...fields, model: fetchedModelName });
        } else {
          const existingCanonical = await LlmCost.findOne({ where: { model: fetchedModelName } });

          if (existingCanonical) {
            logger.info({ modelName, fetchedModelName }, 'Updating existing canonical LLM Cost record');
            await existingCanonical.update(fields);
            cost = existingCanonical;
          } else {
            logger.info({ modelName, fetchedModelName }, 'Creating new LLM Cost record');
            try {
              cost = await LlmCost.create({ model: fetchedModelName, ...fields });
            } catch (createError: any) {
              if (this.isMissingRelationError(createError)) {
                logger.warn({ modelName }, 'llm_costs table does not exist; returning fetched cost without persistence');
                return { model: fetchedModelName, ...fields };
              }
              throw createError;
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error, modelName }, 'Failed to fetch cost for model');
      if (cost) return cost;
      return null;
    }

    return cost;
  }

  private async fetchFromLinkup(query: string): Promise<LinkupPricingResult | null> {
    const url = "https://api.linkup.so/v1/search";
    const apiKey = env.LINKUP_API_KEY;
    if (!apiKey) {
      throw new Error('LINKUP_API_KEY environment variable is not set');
    }

    const payload = {
      q: `pricing cost per million tokens for ${query} LLM model including prompt caching prices`,
      depth: "standard",
      outputType: "structured",
      includeImages: false,
      structuredOutputSchema: JSON.stringify({
        type: "object",
        properties: {
          model: {
            description: "Base model name key (remove provider prefix, use the canonical name used across the internet)",
            type: "string",
          },
          inputTokenPricePerMillionToken: {
            description: "Regular (non-cached) input token price per million tokens in USD",
            type: "number",
          },
          outputTokenPricePerMillionToken: {
            description: "Output token price per million tokens in USD",
            type: "number",
          },
          cacheReadTokenPricePerMillionToken: {
            description: "Cache read (cache hit) token price per million tokens in USD. This is the discounted price paid when tokens are served from cache. For Anthropic models this is typically 10% of input price; for OpenAI models typically 50% of input price. Set to 0 if the model does not support caching.",
            type: "number",
          },
          cacheWrite5mTokenPricePerMillionToken: {
            description: "Cache write price for 5-minute TTL cache per million tokens in USD. For Anthropic models this is typically 1.25× the input price. Set to null if not applicable (e.g. OpenAI auto-caches with no write premium).",
            type: "number",
          },
          cacheWrite1hTokenPricePerMillionToken: {
            description: "Cache write price for 1-hour TTL cache per million tokens in USD. For Anthropic models this is typically 2× the input price. Set to null if not applicable.",
            type: "number",
          },
          contextWindow: {
            description: "Maximum context window size in tokens (e.g. 128000 for 128k context)",
            type: "number",
          },
        },
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
    const result = data?.output ?? data;

    if (
      typeof result?.inputTokenPricePerMillionToken !== 'number' ||
      typeof result?.outputTokenPricePerMillionToken !== 'number'
    ) {
      logger.warn({ modelName: query, rawResponse: data }, 'Linkup API returned unexpected structure; missing required pricing fields');
      return null;
    }

    const inputPrice: number = result.inputTokenPricePerMillionToken;

    // Use Linkup values; derive standard multipliers only when Linkup returns nothing
    const cacheReadPrice: number =
      typeof result.cacheReadTokenPricePerMillionToken === 'number'
        ? result.cacheReadTokenPricePerMillionToken
        : 0;

    const cacheWrite5mPrice: number | null =
      typeof result.cacheWrite5mTokenPricePerMillionToken === 'number'
        ? result.cacheWrite5mTokenPricePerMillionToken
        : null;

    const cacheWrite1hPrice: number | null =
      typeof result.cacheWrite1hTokenPricePerMillionToken === 'number'
        ? result.cacheWrite1hTokenPricePerMillionToken
        : null;

    logger.info({
      modelName: query,
      fetchedModel: result.model,
      inputPrice,
      cacheReadPrice,
      cacheWrite5mPrice,
      cacheWrite1hPrice,
    }, 'Fetched pricing from Linkup');

    return {
      model: result.model,
      inputTokenPricePerMillionToken: inputPrice,
      outputTokenPricePerMillionToken: result.outputTokenPricePerMillionToken,
      cacheReadTokenPricePerMillionToken: cacheReadPrice,
      cacheWrite5mTokenPricePerMillionToken: cacheWrite5mPrice,
      cacheWrite1hTokenPricePerMillionToken: cacheWrite1hPrice,
      contextWindow: typeof result.contextWindow === 'number' ? result.contextWindow : null,
    };
  }
}

export const llmCostService = new LlmCostService();
