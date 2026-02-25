"use client";

import { Button } from "@/components/ui/button";
import { JsonViewer } from "@/components/ui/json-viewer";
import type { TraceDetail } from "@/stores/traceDetailStore";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
} from "lucide-react";
import * as React from "react";

interface TraceSidebarRightProps {
  trace: TraceDetail;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function TraceSidebarRight({ trace, isCollapsed, onToggle }: TraceSidebarRightProps) {
  const [expandedEvents, setExpandedEvents] = React.useState<Set<string>>(new Set());

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Get event badge color based on event type
  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case "user_message":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "llm_response":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "tool_call":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "tool_call_response":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "tool_result":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Simple Badge component
  const Badge = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", className)}>
      {children}
    </span>
  );

  if (isCollapsed) {
    return (
      <div className="flex w-12 flex-col items-center border-l border-border/30 bg-background py-4 transition-all duration-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0 mb-4 hover:bg-surface-2"
        >
          <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="flex flex-col gap-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-2/50" title="Events">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-80 flex-col border-l border-border/30 bg-background transition-all duration-300">
      <div className="flex h-10 items-center justify-between border-b border-border/30 px-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Events
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-6 w-6 p-0 hover:bg-surface-2"
        >
          <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {trace.events && trace.events.length > 0 ? (
            trace.events.map((event, index) => (
              <div
                key={event.id}
                className="rounded-lg border border-border/30 bg-surface-2/30 overflow-hidden"
              >
                {/* Event Header */}
                <button
                  onClick={() => toggleEvent(event.id)}
                  className="flex w-full items-center gap-2 p-3 hover:bg-surface-2/50 transition-colors"
                >
                  {expandedEvents.has(event.id) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <Badge
                    className={cn("text-xs font-normal border", getEventTypeColor(event.eventType))}
                  >
                    {event.eventType}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    #{index + 1}
                  </span>
                  <span className="text-xs text-muted-foreground truncate ml-auto">
                    {event.timeSinceStart}ms
                  </span>
                </button>

                {/* Event Details */}
                {expandedEvents.has(event.id) && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                    {/* Content */}
                    {event.content != null ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-muted-foreground">Content</label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(JSON.stringify(event.content, null, 2))}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="rounded bg-surface-2/50 p-2 max-h-32 overflow-y-auto">
                          <JsonViewer
                            value={typeof event.content === "string"
                              ? event.content
                              : JSON.stringify(event.content, null, 2)}
                            variant="compact"
                          />
                        </div>
                      </div>
                    ) : null}

                    {/* Metadata */}
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Metadata</label>
                        <div className="rounded bg-surface-2/50 p-2 max-h-40 overflow-y-auto">
                          {/* Tool name for tool_call_response */}
                          {event.metadata.tool && (
                            <div className="text-xs mb-2">
                              <span className="text-muted-foreground">Tool: </span>
                              <span className="font-mono text-foreground">{event.metadata.tool}</span>
                            </div>
                          )}

                          {/* Total records for tool_call_response */}
                          {event.metadata.totalRecords !== undefined && (
                            <div className="text-xs mb-2">
                              <span className="text-muted-foreground">Total Records: </span>
                              <span className="text-foreground">{event.metadata.totalRecords}</span>
                            </div>
                          )}

                          {/* Model & Provider */}
                          {(event.metadata.model || event.metadata.provider) && (
                            <div className="flex items-center gap-2 mb-2">
                              {event.metadata.model && (
                                <Badge className="text-xs bg-surface-2 text-foreground border-border">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  {event.metadata.model}
                                </Badge>
                              )}
                              {event.metadata.provider && (
                                <Badge className="text-xs bg-surface-2 text-muted-foreground border-border">
                                  {event.metadata.provider}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Usage */}
                          {event.metadata.usage && (
                            <div className="text-xs space-y-1">
                              <div className="text-muted-foreground font-medium">Usage:</div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <span className="text-muted-foreground">Total:</span>{" "}
                                  <span className="text-foreground">{event.metadata.usage.totalTokens}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Prompt:</span>{" "}
                                  <span className="text-foreground">{event.metadata.usage.promptTokens}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Completion:</span>{" "}
                                  <span className="text-foreground">{event.metadata.usage.completionTokens}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Latency */}
                          {event.metadata.latencyMs && (
                            <div className="text-xs mt-2">
                              <span className="text-muted-foreground">Latency: </span>
                              <span className="text-foreground">{event.metadata.latencyMs}ms</span>
                            </div>
                          )}

                          <JsonViewer
                            value={JSON.stringify(event.metadata, null, 2)}
                            variant="compact"
                          />
                        </div>
                      </div>
                    )}

                    {/* Timing Info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(event.timestamp)}
                      </div>
                      {event.duration !== undefined && event.duration !== null && (
                        <div>
                          {event.duration}ms
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No events in this trace
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
