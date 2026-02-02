import { MetadataParser, TraceMetadata } from './types';

export class OpenAIParser implements MetadataParser {
  extract(content: any, metadata: any): TraceMetadata {
    const result: TraceMetadata = {};

    // 1. Model
    if (metadata?.model) {
      result.model = metadata.model;
    } else if (content?.model) {
      result.model = content.model;
    }

    // 2. System Message & Tools (Usually in first request config)
    // Check if content structure resembles OpenAI request body
    if (content?.messages && Array.isArray(content.messages)) {
      const systemMsg = content.messages.find((m: any) => m.role === 'system');
      if (systemMsg) {
        result.systemMessage = systemMsg.content;
      }
    }

    // Tools
    if (content?.tools) {
      result.tools = content.tools;
    } else if (metadata?.tools) {
      result.tools = metadata.tools;
    }

    return result;
  }
}
