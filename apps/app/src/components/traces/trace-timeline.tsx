"use client";

import type { TraceDetail, TraceEvent } from "@/stores/traceDetailStore";
import { formatDuration } from "@/lib/trace-format";

interface TraceTimelineProps {
  trace: TraceDetail;
}

export function TraceTimeline({ trace }: TraceTimelineProps) {
  if (!trace.events || trace.events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No events in this trace</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-2">
        {trace.events.map((event, index) => (
          <div
            key={event.id}
            className="flex items-start gap-4 rounded-sm border border-border/30 bg-card p-3"
          >
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 text-sm font-medium text-primary">
                {event.stepId}
              </div>
              {index < trace.events.length - 1 && (
                <div className="h-full w-px bg-border/30" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {getEventTypeLabel(event.eventType)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {event.timestamp ? formatTimestamp(event.timestamp) : "N/A"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {getEventDescription(event)}
              </p>
              {event.duration && (
                <p className="text-xs text-muted-foreground">
                  Duration: {formatDurationMs(event.duration)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case "user_message":
      return "User Message";
    case "llm_response":
      return "LLM Response";
    case "tool_call":
      return "Tool Call";
    case "tool_call_request":
      return "Tool Request";
    case "tool_call_response":
      return "Tool Response";
    case "tool_result":
      return "Tool Result";
    case "error":
      return "Error";
    default:
      return eventType;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getEventDescription(event: TraceEvent): string {
  if (Array.isArray(event.content)) {
    return `Tool results (${event.content.length})`;
  }
  if (isRecord(event.content) && "content" in event.content) {
    const content = event.content.content;
    if (typeof content === "string") {
      return content.substring(0, 100) + (content.length > 100 ? "..." : "");
    }
  }
  if (event.metadata?.model) {
    return `Model: ${event.metadata.model}`;
  }
  return "No description available";
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDurationMs(ms: number): string {
  return formatDuration(ms);
}
