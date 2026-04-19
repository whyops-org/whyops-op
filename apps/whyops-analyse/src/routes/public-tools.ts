import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { getRedisClient } from '@whyops/shared/services';
import { createServiceLogger } from '@whyops/shared/logger';
import { llmCostService } from '@whyops/shared/services';
import { MODEL_PRICING_FALLBACK } from '../constants/model-pricing-fallback';
import { parseUniversal } from '../services/universal-parser.service';
import { analyzeContextRot } from '../services/context-rot.service';
import { detectLoops, getRootCause } from '../services/loop-detect.service';
import { resolveModelPricing } from '../services/model-pricing-resolver.service';

const logger = createServiceLogger('analyse:public-tools');
const app = new Hono();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SEC = 3600;

function isRateLimitExempt(ip: string): boolean {
  return process.env.NODE_ENV !== 'production'
    && ['127.0.0.1', '::1', 'localhost', 'unknown'].includes(ip);
}

async function checkRateLimit(ip: string, key: string): Promise<boolean> {
  if (isRateLimitExempt(ip)) return true;
  const redis = await getRedisClient();
  if (!redis) return true;
  const rk = `public-tool-rl:${key}:${ip}:${Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SEC)}`;
  const current = await redis.incr(rk);
  if (current === 1) await redis.expire(rk, RATE_LIMIT_WINDOW_SEC);
  return current <= RATE_LIMIT_MAX;
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

async function parseBody(c: Context): Promise<unknown> {
  try { return await c.req.json(); }
  catch { return null; }
}

// ---------------------------------------------------------------------------
// GET /api/public/model-pricing — live pricing from llm_costs table via Linkup
// ---------------------------------------------------------------------------
const POPULAR_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo',
  'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229', 'claude-3-haiku-20240307',
];

app.get('/model-pricing', async (c) => {
  try {
    const costs = await llmCostService.getCosts(POPULAR_MODELS);
    const models = (Array.isArray(costs) ? costs : [costs]).filter(Boolean).map((cost: any) => ({
      id: cost.model,
      label: cost.model,
      inputPer1M: cost.inputTokenPricePerMillionToken,
      outputPer1M: cost.outputTokenPricePerMillionToken,
      contextWindow: cost.contextWindow ?? 128_000,
    }));
    return c.json({ models: models.length > 0 ? models : MODEL_PRICING_FALLBACK });
  } catch (err) {
    logger.warn({ err }, 'model-pricing: DB/Linkup failed, using fallback');
    return c.json({ models: MODEL_PRICING_FALLBACK });
  }
});

const modelPricingLookupSchema = z.object({
  query: z.string().trim().min(1).max(120),
});

app.post('/model-pricing', async (c) => {
  const ip = getClientIp(c.req.raw);
  if (!(await checkRateLimit(ip, 'model-pricing'))) {
    return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);
  }

  const body = await parseBody(c);
  const parsed = modelPricingLookupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  try {
    const result = await resolveModelPricing(parsed.data.query);
    return c.json(result);
  } catch (err) {
    logger.error({ err, query: parsed.data.query }, 'model-pricing lookup failed');
    return c.json({ error: 'Model lookup failed' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/public/parse — universal structure-independent parsing
// ---------------------------------------------------------------------------
app.post('/parse', async (c) => {
  const ip = getClientIp(c.req.raw);
  if (!(await checkRateLimit(ip, 'parse'))) {
    return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);
  }

  const body = await parseBody(c);
  if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);

  const { data, mode } = body as Record<string, unknown>;
  if (!data) return c.json({ error: 'Missing field: data' }, 400);
  if (mode !== 'events' && mode !== 'messages') return c.json({ error: 'mode must be "events" or "messages"' }, 400);

  try {
    const result = await parseUniversal(data, mode as 'events' | 'messages');
    return c.json(result);
  } catch (err) {
    logger.error({ err }, 'parse failed');
    return c.json({ error: 'Parsing failed' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/public/context-rot — accepts ANY structure
// ---------------------------------------------------------------------------
app.post('/context-rot', async (c) => {
  const ip = getClientIp(c.req.raw);
  if (!(await checkRateLimit(ip, 'context-rot'))) {
    return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);
  }

  const body = await parseBody(c);
  if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);

  const { data, contextWindow } = body as Record<string, unknown>;
  if (!data) return c.json({ error: 'Missing field: data' }, 400);

  const ctxWindow = typeof contextWindow === 'number' ? contextWindow : 128_000;

  try {
    const result = await analyzeContextRot(data, ctxWindow);
    return c.json(result);
  } catch (err) {
    logger.error({ err }, 'context-rot failed');
    return c.json({ error: 'Analysis failed' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/public/loop-detect — accepts raw runs of ANY structure
// ---------------------------------------------------------------------------
const loopDetectSchema = z.object({
  runs: z.array(z.unknown()).min(1).max(5),
  includeRootCause: z.boolean().optional().default(false),
});

app.post('/loop-detect', async (c) => {
  const ip = getClientIp(c.req.raw);
  if (!(await checkRateLimit(ip, 'loop-detect'))) {
    return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);
  }

  const body = await parseBody(c);
  const parsed = loopDetectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);

  try {
    const detection = await detectLoops(parsed.data.runs);
    let rootCause = null;
    if (parsed.data.includeRootCause && (detection.loops.length > 0 || detection.errorPatterns.length > 0)) {
      rootCause = await getRootCause(detection.loops, detection.errorPatterns);
    }
    return c.json({ ...detection, rootCause });
  } catch (err) {
    logger.error({ err }, 'loop-detect failed');
    return c.json({ error: 'Detection failed' }, 500);
  }
});

export default app;
