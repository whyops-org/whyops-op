import { LlmCost } from '../models';
import { Op } from 'sequelize';
import sequelize from '../database';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('shared:llm-cost-service');

export class LlmCostService {
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

    // 1. Search in DB with multiple strategies
    // We try to find the best match using OR logic
    
    let cost = await LlmCost.findOne({
      where: {
        [Op.or]: [
          // A. Exact normalized match
          { model: normalizedName },
          
          // B. Fuzzy match using pg_trgm similarity with LOWER threshold
          // 0.4 was too high for "qwen 3" vs "qwen3-max". Lowering to 0.1
          sequelize.literal(`similarity(model, '${normalizedName}') > 0.1`),
          
          // C. Aggressive Alphanumeric Substring Match (The "Fingerprint" match)
          // If the DB model (stripped of chars) contains the Query (stripped of chars)
          // e.g. DB: "qwen3-max" -> "qwen3max". Query: "qwen 3" -> "qwen3". Match!
          sequelize.where(
            sequelize.fn('regexp_replace', sequelize.fn('lower', sequelize.col('model')), '[^a-z0-9]', '', 'g'),
            { [Op.like]: `%${alphanumericQuery}%` }
          ),
          
          // D. Reverse Aggressive Match (Query contains DB)
          // e.g. Query: "openai/gpt-4" -> "openaigpt4". DB: "gpt-4" -> "gpt4". Match!
          sequelize.literal(`'${alphanumericQuery}' LIKE '%' || regexp_replace(lower(model), '[^a-z0-9]', '', 'g') || '%'`)
        ]
      },
      // Order by:
      // 1. Similarity score (Trigrams are still best for true typos)
      // 2. Length (Prefer longer matches for specificity if similarity is low)
      order: [
        [sequelize.literal(`similarity(model, '${normalizedName}')`), 'DESC'],
        [sequelize.fn('LENGTH', sequelize.col('model')), 'DESC']
      ]
    });

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

        // If we found an expired record, update it
        if (cost) {
          logger.info({ modelName, fetchedModelName }, 'Updating expired LLM Cost record');
          await cost.update({
            inputTokenPricePerMillionToken: fetchedData.inputTokenPricePerMillionToken,
            outputTokenPricePerMillionToken: fetchedData.outputTokenPricePerMillionToken,
            cachedTokenPricePerMillionToken: fetchedData.cachedTokenPricePerMillionToken || 0,
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
             });
             cost = existingCanonical;
          } else {
            // Create new record
            logger.info({ modelName, fetchedModelName }, 'Creating new LLM Cost record');
            cost = await LlmCost.create({
              model: fetchedModelName,
              inputTokenPricePerMillionToken: fetchedData.inputTokenPricePerMillionToken,
              outputTokenPricePerMillionToken: fetchedData.outputTokenPricePerMillionToken,
              cachedTokenPricePerMillionToken: fetchedData.cachedTokenPricePerMillionToken || 0,
            });
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
    const apiKey = "c9a287bc-e8de-492d-94ca-b42658a17293";

    const payload = {
      q: `cost of ${query}`,
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

    const data = await response.json();
    return data; 
  }
}

export const llmCostService = new LlmCostService();
