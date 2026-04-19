import { Op, Sequelize } from 'sequelize';
import env from '@whyops/shared/env';
import { LlmCost } from '@whyops/shared/models';
import { llmCostService } from '@whyops/shared/services';
import { createServiceLogger } from '@whyops/shared/logger';
import { MODEL_PRICING_FALLBACK } from '../constants/model-pricing-fallback';

const logger = createServiceLogger('analyse:model-pricing-resolver');

interface ModelPricing {
  id: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M: number;
  cacheWrite5mPer1M: number | null;
  cacheWrite1hPer1M: number | null;
  contextWindow: number;
  currency: 'USD';
  unit: 'per_1m_tokens';
  supportsPromptCaching: boolean;
  matchedModel: string;
  lastUpdatedAt: string | null;
}

interface LinkupValidation {
  validName: boolean;
  canonicalModel: string | null;
  provider: string | null;
  confidence: 'high' | 'medium' | 'low';
  suggestions: string[];
  reasoning: string | null;
}

export interface ModelPricingLookupResult {
  query: string;
  validName: boolean;
  canonicalModel: string | null;
  provider: string | null;
  confidence: 'high' | 'medium' | 'low';
  validationSource: 'linkup' | 'fallback';
  pricingSource: 'db' | 'linkup' | 'fallback' | 'none';
  pricing: ModelPricing | null;
  suggestions: string[];
  reasoning: string | null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAlnum(value: string): string {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function rankCandidates(query: string, candidates: string[]): string[] {
  const queryNorm = normalizeAlnum(query);
  return [...new Set(candidates)]
    .filter(Boolean)
    .sort((a, b) => {
      const aNorm = normalizeAlnum(a);
      const bNorm = normalizeAlnum(b);
      const aScore = (aNorm === queryNorm ? 1000 : 0)
        + (aNorm.startsWith(queryNorm) ? 300 : 0)
        + (aNorm.includes(queryNorm) ? 150 : 0)
        - levenshtein(queryNorm, aNorm);
      const bScore = (bNorm === queryNorm ? 1000 : 0)
        + (bNorm.startsWith(queryNorm) ? 300 : 0)
        + (bNorm.includes(queryNorm) ? 150 : 0)
        - levenshtein(queryNorm, bNorm);
      return bScore - aScore;
    })
    .slice(0, 5);
}

async function validateWithLinkup(query: string): Promise<LinkupValidation> {
  if (!env.LINKUP_API_KEY) {
    throw new Error('LINKUP_API_KEY environment variable is not set');
  }

  const response = await fetch('https://api.linkup.so/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.LINKUP_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: `Determine whether "${query}" is a real AI model name. If it is valid, return the canonical model name and provider. If not, return up to 5 close real model names.`,
      depth: 'standard',
      outputType: 'structured',
      includeImages: false,
      includeSources: false,
      structuredOutputSchema: JSON.stringify({
        type: 'object',
        properties: {
          validName: { type: 'boolean' },
          canonicalModel: { type: 'string' },
          provider: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          suggestions: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' },
        },
        required: ['validName', 'confidence', 'suggestions'],
      }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Linkup API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const result = ((data.output as Record<string, unknown> | undefined) ?? data) as Record<string, unknown>;
  return {
    validName: result.validName === true,
    canonicalModel: typeof result.canonicalModel === 'string' && result.canonicalModel.trim() ? result.canonicalModel.trim() : null,
    provider: typeof result.provider === 'string' && result.provider.trim() ? result.provider.trim() : null,
    confidence: result.confidence === 'high' || result.confidence === 'medium' ? result.confidence : 'low',
    suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 5) : [],
    reasoning: typeof result.reasoning === 'string' && result.reasoning.trim() ? result.reasoning.trim() : null,
  };
}

async function findSuggestions(query: string): Promise<string[]> {
  const queryNorm = normalize(query);
  const queryAlnum = normalizeAlnum(query);
  const dbMatches = await LlmCost.findAll({
    attributes: ['model'],
    where: {
      [Op.or]: [
        { model: { [Op.iLike]: `%${queryNorm}%` } },
        Sequelize.where(
          Sequelize.fn('regexp_replace', Sequelize.fn('lower', Sequelize.col('model')), '[^a-z0-9]', '', 'g'),
          { [Op.like]: `%${queryAlnum}%` },
        ),
      ],
    },
    limit: 20,
  }).catch(() => []);

  const dbNames = dbMatches.map((row) => row.model);
  const fallbackNames = MODEL_PRICING_FALLBACK.map((item) => item.id);
  return rankCandidates(query, [...dbNames, ...fallbackNames]);
}

function mapPricing(model: any, source: ModelPricingLookupResult['pricingSource']): { pricing: ModelPricing | null; pricingSource: ModelPricingLookupResult['pricingSource'] } {
  if (!model) return { pricing: null, pricingSource: 'none' };
  const pricing = {
    id: model.model ?? model.id,
    label: model.model ?? model.label ?? model.id,
    inputPer1M: model.inputTokenPricePerMillionToken ?? model.inputPer1M,
    outputPer1M: model.outputTokenPricePerMillionToken ?? model.outputPer1M,
    cacheReadPer1M: model.cacheReadTokenPricePerMillionToken ?? model.cacheReadPer1M ?? 0,
    cacheWrite5mPer1M: model.cacheWrite5mTokenPricePerMillionToken ?? model.cacheWrite5mPer1M ?? null,
    cacheWrite1hPer1M: model.cacheWrite1hTokenPricePerMillionToken ?? model.cacheWrite1hPer1M ?? null,
    contextWindow: Number(model.contextWindow ?? 128_000),
    currency: 'USD' as const,
    unit: 'per_1m_tokens' as const,
    supportsPromptCaching: Boolean(
      (model.cacheReadTokenPricePerMillionToken ?? model.cacheReadPer1M ?? 0) > 0
      || model.cacheWrite5mTokenPricePerMillionToken != null
      || model.cacheWrite1hTokenPricePerMillionToken != null
      || model.cacheWrite5mPer1M != null
      || model.cacheWrite1hPer1M != null,
    ),
    matchedModel: model.model ?? model.id,
    lastUpdatedAt: model.updatedAt ? new Date(model.updatedAt).toISOString() : null,
  };
  return { pricing, pricingSource: source };
}

export async function resolveModelPricing(query: string): Promise<ModelPricingLookupResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      query,
      validName: false,
      canonicalModel: null,
      provider: null,
      confidence: 'low',
      validationSource: 'fallback',
      pricingSource: 'none',
      pricing: null,
      suggestions: [],
      reasoning: 'Enter a model name to validate it.',
    };
  }

  const suggestions = await findSuggestions(trimmed);

  try {
    const validation = await validateWithLinkup(trimmed);
    const modelToPrice = validation.canonicalModel ?? trimmed;
    const priced = validation.validName ? await llmCostService.getCosts(modelToPrice) : null;
    const pricedSource = priced
      ? (normalize(priced.model ?? '') === normalize(modelToPrice) ? 'db' : 'linkup')
      : 'none';
    const { pricing, pricingSource } = mapPricing(priced, pricedSource);

    return {
      query,
      validName: validation.validName,
      canonicalModel: validation.canonicalModel,
      provider: validation.provider,
      confidence: validation.confidence,
      validationSource: 'linkup',
      pricingSource,
      pricing,
      suggestions: rankCandidates(trimmed, [...validation.suggestions, ...suggestions]),
      reasoning: validation.reasoning,
    };
  } catch (err) {
    logger.warn({ err, query }, 'Linkup validation failed, using fallback matching');
    const fallback = MODEL_PRICING_FALLBACK.find((item) => normalize(item.id) === normalize(trimmed));
    return {
      query,
      validName: Boolean(fallback),
      canonicalModel: fallback?.id ?? null,
      provider: null,
      confidence: fallback ? 'medium' : 'low',
      validationSource: 'fallback',
      pricingSource: fallback ? 'fallback' : 'none',
      pricing: fallback ? fallback as ModelPricing : null,
      suggestions,
      reasoning: fallback ? 'Matched fallback pricing locally because Linkup validation failed.' : 'Could not validate this model name right now.',
    };
  }
}
