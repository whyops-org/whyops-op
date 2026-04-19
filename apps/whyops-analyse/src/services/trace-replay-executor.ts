import { createServiceLogger } from '@whyops/shared/logger';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { getJudgeModel } from '../langchain/config';
import type { ReplayContext } from './trace-replay-context';
import type { ReplayEvent } from '@whyops/shared/models';

const logger = createServiceLogger('analyse:trace-replay-executor');

const MAX_STEPS = 30;

export interface ReplayExecutionResult {
  events: ReplayEvent[];
  stepsRun: number;
  stopReason: 'final_answer' | 'max_steps' | 'unresolvable_tool' | 'error';
  error?: string;
}

function serializeOutput(output: any): string {
  if (typeof output === 'string') return output;
  try { return JSON.stringify(output); } catch { return String(output); }
}

/**
 * Build DynamicStructuredTool instances that serve recorded outputs.
 * Each tool closes over the cursor map to serve outputs in order.
 */
function buildReplayTools(
  toolDefs: any[],
  recordedOutputs: Map<string, Array<{ output: any }>>,
  cursors: Map<string, number>,
  onUnresolvable: (toolName: string) => void
): DynamicStructuredTool[] {
  return toolDefs.map((t) => {
    const name = t?.name ?? t?.function?.name ?? 'unknown_tool';
    const description = t?.description ?? t?.function?.description ?? '';

    return new DynamicStructuredTool({
      name,
      description,
      schema: z.object({}).passthrough(),
      func: async (_input: Record<string, unknown>) => {
        const list = recordedOutputs.get(name) ?? [];
        const cursor = cursors.get(name) ?? 0;

        if (cursor >= list.length) {
          onUnresolvable(name);
          return `UNRESOLVABLE_TOOL: no recorded output available for ${name}`;
        }

        cursors.set(name, cursor + 1);
        const output = serializeOutput(list[cursor].output);

        logger.debug({ toolName: name, cursor }, 'Served recorded tool output');
        return output;
      },
    });
  });
}

/**
 * Convert LangGraph message history to ReplayEvents for storage and comparison.
 */
function messagesToReplayEvents(
  messages: any[],
  initialUserMessage: string
): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  let stepId = 1;

  for (const msg of messages) {
    const type = msg._getType?.() ?? msg.constructor?.name ?? '';

    if (type === 'human' || msg instanceof HumanMessage) {
      events.push({
        stepId: stepId++,
        eventType: 'user_message',
        content: typeof msg.content === 'string' ? msg.content : initialUserMessage,
        metadata: { source: 'replay' },
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    if (type === 'system' || msg instanceof SystemMessage) {
      // System messages are not user-visible events — skip
      continue;
    }

    if (type === 'ai' || msg instanceof AIMessage) {
      const toolCalls = (msg as any).tool_calls ?? [];
      events.push({
        stepId: stepId++,
        eventType: 'llm_response',
        content: {
          content: typeof msg.content === 'string' ? msg.content : null,
          toolCalls: toolCalls.length > 0
            ? toolCalls.map((tc: any) => ({
                id: tc.id,
                function: { name: tc.name, arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args ?? {}) },
              }))
            : undefined,
          finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
        },
        metadata: { source: 'replay' },
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    if (type === 'tool' || msg instanceof ToolMessage) {
      const toolMsg = msg as ToolMessage;
      events.push({
        stepId: stepId++,
        eventType: 'tool_call_response',
        content: {
          toolName: toolMsg.name ?? toolMsg.tool_call_id ?? 'unknown_tool',
          output: toolMsg.content,
        },
        metadata: { tool: toolMsg.name, source: 'replay' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return events;
}

function buildReplayLLM(ctx: ReplayContext, overrideModel?: string) {
  // Prefer the original trace's provider — this is what makes it a real simulation
  if (ctx.provider && !overrideModel) {
    logger.info(
      { model: ctx.provider.model, baseUrl: ctx.provider.baseUrl },
      'Replay using original trace provider'
    );
    return new ChatOpenAI({
      model: ctx.provider.model,
      apiKey: ctx.provider.apiKey,
      maxRetries: 1,
      timeout: 60000,
      configuration: { baseURL: ctx.provider.baseUrl },
    });
  }

  // Fallback: judge LLM (used when no provider on trace, or explicit override for testing)
  logger.warn(
    { fallback: overrideModel ?? 'judge-llm' },
    'Replay falling back to judge LLM — provider not available on trace'
  );
  return getJudgeModel(overrideModel);
}

export async function executeReplay(
  ctx: ReplayContext,
  overrideModel?: string
): Promise<ReplayExecutionResult> {
  const model = buildReplayLLM(ctx, overrideModel);
  const cursors = new Map<string, number>();
  let unresolvableTool: string | null = null;

  // Build fake tools that serve recorded outputs
  const tools = buildReplayTools(
    ctx.tools,
    ctx.recordedOutputs,
    cursors,
    (toolName) => { unresolvableTool = toolName; }
  );

  if (tools.length === 0) {
    // No tools — run a simple LLM call, no agent loop needed
    logger.info({ traceId: ctx.traceId }, 'No tools defined — running single LLM call');
    try {
      const messages: any[] = [];
      if (ctx.systemPrompt) messages.push(new SystemMessage(ctx.systemPrompt));
      messages.push(new HumanMessage(ctx.initialUserMessage || '(no user message)'));

      const response = await model.invoke(messages);
      messages.push(response);

      return {
        events: messagesToReplayEvents(messages, ctx.initialUserMessage),
        stepsRun: 1,
        stopReason: 'final_answer',
      };
    } catch (err: any) {
      return { events: [], stepsRun: 0, stopReason: 'error', error: err?.message ?? 'LLM call failed' };
    }
  }

  // Build the LangGraph React agent
  const agent = createReactAgent({
    llm: model as any,
    tools,
    stateModifier: ctx.systemPrompt
      ? new SystemMessage(ctx.systemPrompt)
      : undefined,
  });

  logger.info(
    { traceId: ctx.traceId, toolCount: tools.length, maxSteps: MAX_STEPS },
    'Starting replay agent'
  );

  try {
    const result = await agent.invoke(
      { messages: [new HumanMessage(ctx.initialUserMessage || '(no user message)')] },
      { recursionLimit: MAX_STEPS }
    );

    const allMessages: any[] = result.messages ?? [];
    const events = messagesToReplayEvents(allMessages, ctx.initialUserMessage);

    // Detect stop reason
    let stopReason: ReplayExecutionResult['stopReason'] = 'final_answer';
    if (unresolvableTool) {
      stopReason = 'unresolvable_tool';
      events.push({
        stepId: events.length + 1,
        eventType: 'error',
        content: { error: `UNRESOLVABLE_TOOL: no recorded output for ${unresolvableTool}`, source: 'replay' },
        metadata: { source: 'replay' },
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(
      { traceId: ctx.traceId, eventCount: events.length, stopReason },
      'Replay agent completed'
    );

    return { events, stepsRun: events.length, stopReason };
  } catch (err: any) {
    const msg = err?.message ?? 'Agent execution failed';
    const isMaxSteps = /recursion|max.*iter|too many/i.test(msg);

    logger.error({ err, traceId: ctx.traceId }, 'Replay agent error');

    return {
      events: [],
      stepsRun: 0,
      stopReason: isMaxSteps ? 'max_steps' : 'error',
      error: msg,
    };
  }
}
