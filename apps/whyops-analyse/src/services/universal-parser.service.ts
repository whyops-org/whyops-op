import { createContext, Script } from 'vm';
import { getRedisClient } from '@whyops/shared/services';
import { createServiceLogger } from '@whyops/shared/logger';
import { hashSchema, schemaPathsForPrompt } from './schema-fingerprint';
import { detectAndConvert, type NormalizedEvent, type NormalizedMessage, type ParseMode } from './format-heuristics';
import { getJudgeModel } from '../langchain';
import { extractLooseConversation } from './loose-conversation-extractor';

const logger = createServiceLogger('analyse:universal-parser');

const CACHE_TTL_SEC = 30 * 24 * 3600; // 30 days
const VM_TIMEOUT_MS = 5000;
const MAX_RESULT_EVENTS = 500;

export interface ParseResult {
  format: string;
  detectionMethod: 'heuristic' | 'cache' | 'llm-generated' | 'failed';
  events: NormalizedEvent[];
  messages: NormalizedMessage[];
  failureReason?: string;
}

// ---------------------------------------------------------------------------
// Redis cache helpers
// ---------------------------------------------------------------------------
async function getCachedFn(schemaHash: string, mode: ParseMode): Promise<string | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  return redis.get(`parse:v1:${schemaHash}:${mode}`);
}

async function cacheFn(schemaHash: string, mode: ParseMode, fnBody: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  await redis.set(`parse:v1:${schemaHash}:${mode}`, fnBody, { EX: CACHE_TTL_SEC });
}

// ---------------------------------------------------------------------------
// Safe vm execution of LLM-generated transform function
// ---------------------------------------------------------------------------
function runInSandbox(fnBody: string, input: unknown): unknown[] {
  const ctx = createContext({ input, result: [] });
  // Wrap body: function receives `input`, writes to `result`
  const script = new Script(
    `result = (function transform(input) { try { ${fnBody} } catch(e) { return []; } })(input)`,
    { filename: 'transform.js' }
  );
  script.runInContext(ctx, { timeout: VM_TIMEOUT_MS });
  const result = ctx.result;
  if (!Array.isArray(result)) return [];
  return result.slice(0, MAX_RESULT_EVENTS);
}

// ---------------------------------------------------------------------------
// Validate that sandbox output looks like NormalizedEvent[]
// ---------------------------------------------------------------------------
function isValidEventArray(arr: unknown[]): arr is NormalizedEvent[] {
  if (arr.length === 0) return true;
  const first = arr[0] as Record<string, unknown>;
  return typeof first.stepId === 'number' && typeof first.eventType === 'string';
}

function isValidMessageArray(arr: unknown[]): arr is NormalizedMessage[] {
  if (arr.length === 0) return true;
  const first = arr[0] as Record<string, unknown>;
  return typeof first.role === 'string' && typeof first.content === 'string';
}

// ---------------------------------------------------------------------------
// LLM code generation
// ---------------------------------------------------------------------------
const EVENT_FORMAT_SPEC = `Array of objects with:
- id: string (unique, e.g. "s1")
- stepId: number (1-based index)
- eventType: one of "user_message" | "llm_response" | "tool_call_request" | "tool_call_response" | "tool_result" | "error"
- timestamp: ISO string
- content:
  - for user_message: string
  - for llm_response: { content?: string, toolCalls?: [{ id?: string, name: string, arguments?: string }], finishReason?: string }
  - for tool_call_request: { id?: string, name: string, arguments?: any }
  - for tool_call_response/tool_result/error: string or object
- metadata (optional): { tool?: string, model?: string, latency?: number, tool_call_id?: string, toolCallId?: string }`;

const MESSAGE_FORMAT_SPEC = `Array of objects with:
- role: "system" | "user" | "assistant" | "tool"
- content: string (text content only)`;

async function generateTransformFn(obj: unknown, mode: ParseMode): Promise<string | null> {
  const schemaPaths = schemaPathsForPrompt(obj);
  const formatSpec = mode === 'events' ? EVENT_FORMAT_SPEC : MESSAGE_FORMAT_SPEC;

  const prompt = `You are a data transformation expert. Write a JavaScript function body that transforms input data into a specific format.

Input data schema (key paths and types — these are structure paths, not actual values):
${schemaPaths}

Target output format:
${formatSpec}

Requirements:
- Write ONLY the function body code (no function declaration, no markdown)
- The input is available as the variable \`input\`
- Return an array in the target format
- Use optional chaining (?.) for all property access
- Do not use require(), import, or any external functions
- If the format is unrecognizable, return []
- Handle arrays safely: check Array.isArray() before iterating
- Assign stepId as 1-based incrementing index
- For event mode, prefer the richer event types/content shapes exactly as specified

Write the function body now:`;

  try {
    const model = getJudgeModel();
    const response = await model.invoke(prompt);
    const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    // Strip any markdown code fences the model might include
    const cleaned = raw
      .replace(/^```(?:javascript|js)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    return cleaned || null;
  } catch (err) {
    logger.warn({ err }, 'LLM codegen failed');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function parseUniversal(input: unknown, mode: ParseMode): Promise<ParseResult> {
  const empty: ParseResult = {
    format: 'unknown', detectionMethod: 'failed', events: [], messages: [],
  };

  if (input === null || input === undefined) return empty;

  const schemaHash = hashSchema(input);

  // 1. Redis cache check
  const cached = await getCachedFn(schemaHash, mode);
  if (cached) {
    try {
      const raw = runInSandbox(cached, input);
      if (mode === 'events' && isValidEventArray(raw as unknown[])) {
        logger.info({ schemaHash }, 'parse: cache hit');
        return { format: 'cached', detectionMethod: 'cache', events: raw as NormalizedEvent[], messages: [] };
      }
      if (mode === 'messages' && isValidMessageArray(raw as unknown[])) {
        logger.info({ schemaHash }, 'parse: cache hit (messages)');
        return { format: 'cached', detectionMethod: 'cache', events: [], messages: raw as NormalizedMessage[] };
      }
    } catch (err) {
      logger.warn({ err, schemaHash }, 'Cached transform failed; falling through');
    }
  }

  // 2. Heuristic detection
  const heuristic = detectAndConvert(input, mode);
  if (heuristic) {
    logger.info({ format: heuristic.format }, 'parse: heuristic match');
    return {
      format: heuristic.format,
      detectionMethod: 'heuristic',
      events: heuristic.events ?? [],
      messages: heuristic.messages ?? [],
    };
  }

  // 3. LLM code generation (schema only, ~800 tokens once)
  logger.info({ schemaHash }, 'parse: no heuristic match, calling LLM codegen');
  const fnBody = await generateTransformFn(input, mode);
  if (!fnBody) {
    const looseConversation = extractLooseConversation(input);
    if (looseConversation) {
      logger.info({ schemaHash }, 'parse: loose conversation fallback match');
      return {
        format: 'recursive-conversation',
        detectionMethod: 'heuristic',
        events: mode === 'events' ? looseConversation.events : [],
        messages: looseConversation.messages,
      };
    }
    return { ...empty, failureReason: 'LLM codegen returned no transform function and no conversation-like structure could be inferred.' };
  }

  try {
    const raw = runInSandbox(fnBody, input);
    if (mode === 'events' && isValidEventArray(raw as unknown[])) {
      await cacheFn(schemaHash, mode, fnBody);
      return { format: 'llm-generated', detectionMethod: 'llm-generated', events: raw as NormalizedEvent[], messages: [] };
    }
    if (mode === 'messages' && isValidMessageArray(raw as unknown[])) {
      await cacheFn(schemaHash, mode, fnBody);
      return { format: 'llm-generated', detectionMethod: 'llm-generated', events: [], messages: raw as NormalizedMessage[] };
    }
    logger.warn({ schemaHash }, 'LLM codegen produced invalid output shape');

    if (mode === 'events') {
      const messageFnBody = await generateTransformFn(input, 'messages');
      if (messageFnBody) {
        const messageRaw = runInSandbox(messageFnBody, input);
        if (isValidMessageArray(messageRaw as unknown[])) {
          const messages = messageRaw as NormalizedMessage[];
          const events = messages
            .filter((m) => m.role !== 'system')
            .map((m, index) => ({
              id: `s${index + 1}`,
              stepId: index + 1,
              eventType: m.role === 'user' ? 'user_message' : m.role === 'tool' ? 'tool_call_response' : 'llm_response',
              timestamp: new Date(Date.now() + index * 1000).toISOString(),
              content: m.role === 'user' ? m.content : m.role === 'tool' ? m.content : { content: m.content },
            })) as NormalizedEvent[];
          if (events.length > 0) {
            await cacheFn(schemaHash, 'messages', messageFnBody);
            return {
              format: 'llm-generated',
              detectionMethod: 'llm-generated',
              events,
              messages,
            };
          }
        }
      }
    }

    const looseConversation = extractLooseConversation(input);
    if (looseConversation) {
      logger.info({ schemaHash }, 'parse: loose conversation fallback after invalid LLM output');
      return {
        format: 'recursive-conversation',
        detectionMethod: 'heuristic',
        events: mode === 'events' ? looseConversation.events : [],
        messages: looseConversation.messages,
      };
    }
  } catch (err) {
    logger.warn({ err, schemaHash }, 'LLM codegen vm execution failed');
    const looseConversation = extractLooseConversation(input);
    if (looseConversation) {
      logger.info({ schemaHash }, 'parse: loose conversation fallback after vm error');
      return {
        format: 'recursive-conversation',
        detectionMethod: 'heuristic',
        events: mode === 'events' ? looseConversation.events : [],
        messages: looseConversation.messages,
      };
    }
    return { ...empty, failureReason: 'LLM-generated transform crashed during sandbox execution.' };
  }

  return { ...empty, failureReason: 'No heuristic matched and LLM-generated transform returned empty or invalid output.' };
}
