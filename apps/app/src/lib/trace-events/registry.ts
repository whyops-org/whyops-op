import type { EventHandler, EventHandlerMap, TraceEvent, CanvasNodeData, SidebarData, TimelineData } from "./types";
import { DEFAULT_NODE_CONFIG } from "./types";

import { UserMessageHandler } from "./handlers/user-message.handler";
import { LlmResponseHandler } from "./handlers/llm-response.handler";
import { ToolCallHandler } from "./handlers/tool-call.handler";
import { ToolResultEventHandler, ToolResultHandler } from "./handlers/tool-result.handler";
import { ErrorMessageHandler } from "./handlers/error-message.handler";
import { AgentMessageHandler } from "./handlers/agent-message.handler";
import { SystemMessageHandler } from "./handlers/system-message.handler";
import { LlmThinkingHandler } from "./handlers/llm-thinking.handler";

class EventHandlerRegistry {
  private handlers: EventHandlerMap = new Map();

  constructor() {
    this.registerBuiltInHandlers();
  }

  private registerBuiltInHandlers(): void {
    this.register(UserMessageHandler);
    this.register(LlmResponseHandler);
    this.register(ToolCallHandler);
    this.register(ToolResultHandler);
    this.register(ToolResultEventHandler);
    this.register(ErrorMessageHandler);
    this.register(AgentMessageHandler);
    this.register(SystemMessageHandler);
    this.register(LlmThinkingHandler);
  }

  register(handler: EventHandler): void {
    this.handlers.set(handler.eventType, handler);
  }

  get(eventType: string): EventHandler | undefined {
    return this.handlers.get(eventType);
  }

  has(eventType: string): boolean {
    return this.handlers.has(eventType);
  }

  getNodeConfig(eventType: string): EventHandler["nodeConfig"] {
    const handler = this.handlers.get(eventType);
    return handler?.nodeConfig ?? DEFAULT_NODE_CONFIG;
  }

  getCanvasData(event: TraceEvent): CanvasNodeData {
    const handler = this.handlers.get(event.eventType);
    if (handler) {
      return handler.getCanvasData(event);
    }
    return this.getDefaultCanvasData(event);
  }

  getSidebarData(event: TraceEvent): SidebarData {
    const handler = this.handlers.get(event.eventType);
    if (handler) {
      return handler.getSidebarData(event);
    }
    return this.getDefaultSidebarData(event);
  }

  getTimelineData(event: TraceEvent): TimelineData {
    const handler = this.handlers.get(event.eventType);
    if (handler) {
      return handler.getTimelineData(event);
    }
    return this.getDefaultTimelineData(event);
  }

  shouldDisplay(event: TraceEvent): boolean {
    const handler = this.handlers.get(event.eventType);
    if (handler?.shouldDisplay) {
      return handler.shouldDisplay(event);
    }
    return true;
  }

  getAllEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  getAllHandlers(): EventHandler[] {
    return Array.from(this.handlers.values());
  }

  private getDefaultCanvasData(event: TraceEvent): CanvasNodeData {
    return {
      label: DEFAULT_NODE_CONFIG.label,
      eventType: event.eventType,
      content: event.content,
      metadata: event.metadata,
      stepId: event.stepId,
      parentStepId: event.parentStepId ?? null,
      spanId: event.spanId ?? null,
      timestamp: event.timestamp,
      duration: event.duration ?? null,
      timeSinceStart: event.timeSinceStart ?? 0,
      isLateEvent: event.isLateEvent ?? false,
      contentText: typeof event.content === "string" ? event.content : JSON.stringify(event.content),
      nodeType: DEFAULT_NODE_CONFIG.nodeType,
      highlight: DEFAULT_NODE_CONFIG.highlight ?? false,
    };
  }

  private getDefaultSidebarData(event: TraceEvent): SidebarData {
    return {
      title: `Event: ${event.eventType}`,
      sections: [
        {
          title: "Content",
          type: "json",
          content: event.content as Record<string, unknown>,
        },
        {
          title: "Metadata",
          type: "json",
          content: event.metadata as Record<string, unknown>,
        },
      ],
    };
  }

  private getDefaultTimelineData(event: TraceEvent): TimelineData {
    return {
      title: event.eventType,
      description: `Step ${event.stepId}`,
      status: "completed",
      timestamp: event.timestamp,
      duration: event.duration ?? undefined,
    };
  }
}

export const eventHandlerRegistry = new EventHandlerRegistry();

export function registerEventHandler(handler: EventHandler): void {
  eventHandlerRegistry.register(handler);
}
