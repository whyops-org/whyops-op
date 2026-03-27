import { createServiceLogger } from '@whyops/shared/logger';
import type { AnthropicMessageResponse, AnthropicStreamEvent } from '../types/anthropic';

const logger = createServiceLogger('proxy:parser:anthropic');

export interface ParsedResponse {
  content?: string;
  toolCalls?: any[];
  finishReason?: string;
  usage?: {
    /** Non-cached input tokens only (after the last cache breakpoint). */
    promptTokens: number;
    completionTokens: number;
    /** Sum of all input token types + output tokens. */
    totalTokens: number;
    /** Tokens written to 5-minute cache. */
    cacheWrite5mTokens?: number;
    /** Tokens written to 1-hour cache. */
    cacheWrite1hTokens?: number;
    /** Total cache-write tokens (5m + 1h combined). Used when TTL breakdown is unavailable. */
    cacheCreationTokens?: number;
    /** Tokens served from cache (cache hit). */
    cacheReadTokens?: number;
  };
  thinkingBlocks?: Array<
    | { type: 'thinking'; thinking: string; signature?: string }
    | { type: 'redacted_thinking'; data: string }
  >;
  id?: string;
  created?: number;
}

export class AnthropicParser {
  /**
   * Parse a non-streaming response from Anthropic.
   *
   * NOTE: input_tokens in the response is ONLY the non-cached tokens.
   * Total input = input_tokens + cache_creation_input_tokens + cache_read_input_tokens.
   */
  static parseResponse(data: AnthropicMessageResponse): ParsedResponse {
    let content = '';
    const toolCalls: any[] = [];
    const thinkingBlocks: ParsedResponse['thinkingBlocks'] = [];

    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text' && (block as any).text) {
          content += (block as any).text;
        }
        if (block.type === 'thinking') {
          thinkingBlocks?.push({
            type: 'thinking',
            thinking: (block as any).thinking || '',
            signature: (block as any).signature,
          });
        }
        if (block.type === 'redacted_thinking') {
          thinkingBlocks?.push({
            type: 'redacted_thinking',
            data: (block as any).data || '',
          });
        }
        if (block.type === 'tool_use' || block.type === 'server_tool_use') {
          const input = (block as any).input ?? {};
          toolCalls.push({
            id: (block as any).id,
            type: 'function',
            function: {
              name: (block as any).name,
              arguments: JSON.stringify(input),
            },
          });
        }
      }
    }

    return {
      content: content || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.stop_reason || undefined,
      thinkingBlocks: thinkingBlocks && thinkingBlocks.length > 0 ? thinkingBlocks : undefined,
      usage: data.usage
        ? AnthropicParser.extractUsage(data.usage)
        : undefined,
      id: data.id,
      created: Date.now(),
    };
  }

  /**
   * Parse a single SSE event from a streaming response.
   * Cache token counts are available in message_start.message.usage.
   */
  static parseStreamEvent(
    data: AnthropicStreamEvent,
    accumulated: ParsedResponse,
    toolCallState?: Map<number, any>,
    thinkingState?: Map<number, any>
  ): ParsedResponse {
    const result: ParsedResponse = { ...accumulated };

    switch (data.type) {
      case 'message_start':
        if (data.message?.id) result.id = data.message.id;
        if (data.message?.usage) {
          result.usage = AnthropicParser.extractUsage(data.message.usage, 0);
        }
        break;

      case 'content_block_start':
        if (data.content_block?.type === 'tool_use' || data.content_block?.type === 'server_tool_use') {
          const input = (data.content_block as any).input ?? {};
          const index = data.index ?? 0;
          const toolCall = {
            id: (data.content_block as any).id,
            type: 'function',
            function: {
              name: (data.content_block as any).name,
              arguments: Object.keys(input).length > 0 ? JSON.stringify(input) : '',
            },
          };
          if (toolCallState) toolCallState.set(index, toolCall);
          result.toolCalls = Array.from(toolCallState?.values() || [toolCall]);
        }
        if (data.content_block?.type === 'thinking') {
          const index = data.index ?? 0;
          if (thinkingState) {
            thinkingState.set(index, { type: 'thinking', thinking: '', signature: '' });
          }
        }
        if (data.content_block?.type === 'redacted_thinking') {
          const index = data.index ?? 0;
          if (thinkingState) {
            thinkingState.set(index, { type: 'redacted_thinking', data: (data.content_block as any).data || '' });
          }
        }
        break;

      case 'content_block_delta':
        if (data.delta?.type === 'text_delta') {
          result.content = (result.content || '') + data.delta.text;
        }
        if (data.delta?.type === 'thinking_delta') {
          const index = data.index ?? 0;
          const existing = thinkingState?.get(index);
          if (existing && existing.type === 'thinking') {
            existing.thinking = (existing.thinking || '') + data.delta.thinking;
            thinkingState?.set(index, existing);
          }
        }
        if (data.delta?.type === 'signature_delta') {
          const index = data.index ?? 0;
          const existing = thinkingState?.get(index);
          if (existing && existing.type === 'thinking') {
            existing.signature = data.delta.signature;
            thinkingState?.set(index, existing);
          }
        }
        if (data.delta?.type === 'input_json_delta') {
          const index = data.index ?? 0;
          const existing = toolCallState?.get(index);
          if (existing) {
            existing.function.arguments = (existing.function.arguments || '') + data.delta.partial_json;
            toolCallState?.set(index, existing);
            result.toolCalls = toolCallState
              ? Array.from(toolCallState.values())
              : [existing];
          }
        }
        if (thinkingState) {
          result.thinkingBlocks = Array.from(thinkingState.values());
        }
        break;

      case 'message_delta':
        if (data.delta?.stop_reason) {
          result.finishReason = data.delta.stop_reason;
        }
        if (data.usage) {
          // message_delta carries output_tokens; preserve cache fields from message_start
          const outputTokens = data.usage.output_tokens ?? 0;
          const existing = result.usage;
          const promptTokens = existing?.promptTokens ?? 0;
          const cacheCreationTokens = existing?.cacheCreationTokens ?? 0;
          const cacheReadTokens = existing?.cacheReadTokens ?? 0;
          result.usage = {
            promptTokens,
            completionTokens: outputTokens,
            totalTokens: promptTokens + cacheCreationTokens + cacheReadTokens + outputTokens,
            cacheWrite5mTokens: existing?.cacheWrite5mTokens,
            cacheWrite1hTokens: existing?.cacheWrite1hTokens,
            cacheCreationTokens: existing?.cacheCreationTokens,
            cacheReadTokens: existing?.cacheReadTokens,
          };
        }
        break;

      case 'message_stop':
        break;
      case 'error':
        result.finishReason = 'error';
        break;
    }

    return result;
  }

  static getInitialStreamState(): ParsedResponse {
    return {
      content: '',
      toolCalls: undefined,
      finishReason: undefined,
      usage: undefined,
      thinkingBlocks: undefined,
    };
  }

  /**
   * Extract usage from an Anthropic usage object.
   * @param usageData  Raw usage block from Anthropic response.
   * @param outputTokens  Override for output tokens (0 during message_start in streaming).
   */
  private static extractUsage(
    usageData: NonNullable<AnthropicMessageResponse['usage']>,
    outputTokens?: number
  ): ParsedResponse['usage'] {
    const inputTokens = usageData.input_tokens ?? 0;
    const output = outputTokens !== undefined ? outputTokens : (usageData.output_tokens ?? 0);

    // TTL-split cache write tokens from the cache_creation sub-object
    const cache5m: number | undefined = (usageData.cache_creation as any)?.ephemeral_5m_input_tokens ?? undefined;
    const cache1h: number | undefined = (usageData.cache_creation as any)?.ephemeral_1h_input_tokens ?? undefined;

    // Top-level total cache creation tokens (sum of both TTLs)
    const cacheCreationTotal: number = usageData.cache_creation_input_tokens ?? 0;
    const cacheReadTotal: number = usageData.cache_read_input_tokens ?? 0;

    return {
      promptTokens: inputTokens,
      completionTokens: output,
      totalTokens: inputTokens + cacheCreationTotal + cacheReadTotal + output,
      cacheWrite5mTokens: cache5m,
      cacheWrite1hTokens: cache1h,
      cacheCreationTokens: cacheCreationTotal > 0 ? cacheCreationTotal : undefined,
      cacheReadTokens: cacheReadTotal > 0 ? cacheReadTotal : undefined,
    };
  }
}
