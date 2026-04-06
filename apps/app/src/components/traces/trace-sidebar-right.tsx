"use client";

import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import * as React from "react";

interface TraceSidebarRightProps {
  trace: TraceDetail;
  isCollapsed: boolean;
  onToggle: () => void;
}

function asJsonString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getEventTypeBadgeClass(eventType: string): string {
  if (eventType === "error") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (eventType === "llm_response") {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  if (eventType === "tool_result" || eventType === "tool_call_response") {
    return "border-border/70 bg-surface-2/50 text-foreground";
  }
  return "border-border/70 bg-surface-2/30 text-muted-foreground";
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface JsonSectionProps {
  label: string;
  value: unknown;
}

function JsonSection({ label, value }: JsonSectionProps) {
  const json = asJsonString(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(json);
            } catch {
              // Ignore clipboard failures
            }
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="max-h-52 overflow-auto rounded-sm border border-border/50 bg-surface-2/30 p-3">
        <JsonViewer value={json} variant="compact" />
      </div>
    </div>
  );
}

interface EventMetaSummaryProps {
  metadata: Record<string, unknown>;
  event?: TraceDetail["events"][number];
}

function EventMetaSummary({ metadata, event }: EventMetaSummaryProps) {
  // Prefer typed columns (Phase 2); fall back to metadata JSONB for old events
  const model = event?.model ?? (typeof metadata.model === "string" ? metadata.model : null);
  const provider = typeof metadata.provider === "string" ? metadata.provider : null;
  const tool = typeof metadata.tool === "string" ? metadata.tool : null;
  const latencyMs = event?.latencyMs ?? (typeof metadata.latencyMs === "number" ? metadata.latencyMs : null);
  const totalRecords = typeof metadata.totalRecords === "number" ? metadata.totalRecords : null;

  // Total tokens: typed columns first, then metadata.usage
  const promptTokens = event?.promptTokens ?? null;
  const completionTokens = event?.completionTokens ?? null;
  const typedTotal = (promptTokens != null && completionTokens != null)
    ? promptTokens + completionTokens
    : null;
  const usage = isRecord(metadata.usage) ? metadata.usage : null;
  const metaTotal = typeof usage?.totalTokens === "number" ? usage.totalTokens : null;
  const totalTokens = typedTotal ?? metaTotal;

  if (!model && !provider && !tool && latencyMs === null && totalRecords === null && totalTokens === null) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tool ? <Badge className="font-mono">{tool}</Badge> : null}
      {model ? <Badge className="font-mono">{model}</Badge> : null}
      {provider ? <Badge>{provider}</Badge> : null}
      {totalTokens !== null ? <Badge>{totalTokens.toLocaleString()} tokens</Badge> : null}
      {latencyMs !== null ? <Badge>{latencyMs}ms</Badge> : null}
      {totalRecords !== null ? <Badge>{totalRecords} records</Badge> : null}
    </div>
  );
}

interface EventCardProps {
  event: TraceDetail["events"][number];
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

function EventCard({ event, index, expanded, onToggle }: EventCardProps) {
  const metadata = isRecord(event.metadata) ? event.metadata : null;

  return (
    <div className="overflow-hidden rounded-sm border border-border/50 bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-2/40"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Badge className={cn("font-mono", getEventTypeBadgeClass(event.eventType))}>
          {event.eventType}
        </Badge>
        <span className="text-sm text-muted-foreground">#{index + 1}</span>
        <span className="ml-auto text-sm text-muted-foreground">{event.timeSinceStart ?? 0}ms</span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border/50 px-4 py-4">
          {event.content !== null && event.content !== undefined ? (
            <JsonSection label="Content" value={event.content} />
          ) : null}

          {metadata ? (
            <>
              <EventMetaSummary metadata={metadata} event={event} />
              <JsonSection label="Metadata" value={metadata} />
            </>
          ) : null}

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTimestamp(event.timestamp)}
            </div>
            {typeof event.duration === "number" ? <div>{event.duration}ms</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
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

  if (isCollapsed) {
    return (
      <div className="flex w-[52px] flex-col items-center border-l border-border/50 bg-background py-4 transition-all duration-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="mb-4 h-8 w-8 p-0 hover:bg-surface-2/40"
        >
          <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border/60 bg-surface-2/30">
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
      <div className="flex w-[380px] flex-col border-l border-border/50 bg-background transition-all duration-300 xl:w-[400px]">
      <div className="flex h-12 items-center justify-between border-b border-border/50 px-4">
        <h3 className="text-sm font-medium text-muted-foreground">Events</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-6 w-6 p-0 hover:bg-surface-2/40"
        >
          <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {trace.events.length > 0 ? (
          <div className="space-y-2.5">
            {trace.events.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                index={index}
                expanded={expandedEvents.has(event.id)}
                onToggle={() => toggleEvent(event.id)}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No events in this trace
          </div>
        )}
      </div>
    </div>
  );
}
