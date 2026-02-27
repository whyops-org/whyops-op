import { MetadataParser, TraceMetadata } from './types';

export class OpenAIParser implements MetadataParser {
  private normalizeMessageText(content: any): string | undefined {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return undefined;

    const text = content
      .filter((part: any) => part && (part.type === 'text' || part.type === 'input_text' || part.type === 'output_text'))
      .map((part: any) => part.text)
      .filter((t: any) => typeof t === 'string')
      .join('\n')
      .trim();

    return text || undefined;
  }

  extract(content: any, metadata: any): TraceMetadata {
    const result: TraceMetadata = {};

    // 1. Model
    if (metadata?.model) {
      result.model = metadata.model;
    } else if (content?.model) {
      result.model = content.model;
    }

    // 2. System Message & Tools (Usually in first request config)
    // Content can be an OpenAI request body OR directly the messages array.
    const messages = Array.isArray(content)
      ? content
      : (content?.messages && Array.isArray(content.messages) ? content.messages : undefined);

    if (messages) {
      const systemMsg = messages.find((m: any) => m.role === 'system' || m.role === 'developer');
      if (systemMsg) {
        result.systemMessage = this.normalizeMessageText(systemMsg.content) || systemMsg.content;
      }
    }

    if (!result.systemMessage && metadata?.systemPrompt) {
      result.systemMessage = metadata.systemPrompt;
    }

    // Tools
    if (content?.tools) {
      result.tools = content.tools;
    } else if (metadata?.tools) {
      result.tools = metadata.tools;
    } else if (metadata?.params?.tools) {
      result.tools = metadata.params.tools;
    }

    return result;
  }
}
