import { Hono } from 'hono';
import { LLMEvent } from '@whyops/shared/models';
import { createServiceLogger } from '@whyops/shared/logger';

const logger = createServiceLogger('analyse:visualize');
const app = new Hono();

// Helper to escape Mermaid string
function escapeMermaid(text: string): string {
  if (!text) return '';
  return text
    .replace(/["\n\r]/g, ' ') // Replace newlines and quotes
    .replace(/;/g, ',')       // Replace semicolons (Mermaid statement end)
    .trim()
    .substring(0, 50) + (text.length > 50 ? '...' : ''); // Truncate
}

// GET /api/visualize/:traceId/mermaid
app.get('/:traceId/mermaid', async (c) => {
  const traceId = c.req.param('traceId');

  try {
    const events = await LLMEvent.findAll({
      where: { traceId },
      order: [['stepId', 'ASC'], ['timestamp', 'ASC']],
    });

    if (events.length === 0) {
      return c.text('graph TD\n    NoEvents[No events found for this trace]');
    }

    let diagram = 'sequenceDiagram\n    participant User\n    participant Agent\n    participant Tool\n\n';

    for (const event of events) {
      const type = event.eventType;
      const content = event.content;

      if (type === 'user_message') {
        // User message
        let msg = '';
        if (Array.isArray(content)) {
          // Array of messages (common in chat completion request)
          const lastMsg = content[content.length - 1];
          if (lastMsg.role === 'user') {
            msg = lastMsg.content;
          } else if (lastMsg.role === 'tool') {
             // This is actually a return from tool execution in the conversation history
             // We can skip this if we handle 'tool_call' event explicitly, 
             // but 'user_message' often contains the whole context.
             // Let's try to extract the actual user text if possible.
             // If it's just a tool output, maybe don't visualize it here as 'User->Agent'
             // unless it's a new turn.
             continue; 
          }
        } else if (typeof content === 'string') {
          msg = content;
        }
        
        if (msg) {
          diagram += `    User->>Agent: ${escapeMermaid(msg)}\n`;
        }
      } 
      
      else if (type === 'llm_response') {
        // LLM Response
        if (content.toolCalls && content.toolCalls.length > 0) {
          // Tool Call Request
          for (const tool of content.toolCalls) {
            const funcName = tool.function?.name || 'unknown_tool';
            const args = tool.function?.arguments || '';
            diagram += `    Agent->>Tool: Call ${funcName}(${escapeMermaid(args)})\n`;
          }
        } else if (content.content) {
          // Text Response
          diagram += `    Agent->>User: ${escapeMermaid(content.content)}\n`;
        }
      } 
      
      else if (type === 'tool_call') {
        // Tool Execution Result
        const toolName = content.toolName || 'Tool';
        const output = typeof content.output === 'string' ? content.output : JSON.stringify(content.output);
        diagram += `    Tool-->>Agent: Result from ${toolName}: ${escapeMermaid(output)}\n`;
      } 
      
      else if (type === 'error') {
        diagram += `    Agent--xUser: Error: ${escapeMermaid(content.message || JSON.stringify(content))}\n`;
      }
    }

    return c.text(diagram);
  } catch (error: any) {
    logger.error({ error }, 'Failed to generate mermaid chart');
    return c.text('graph TD\n    Error[Failed to generate chart]');
  }
});

export default app;
