"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TraceDetail } from "@/stores/traceDetailStore";
import { getModelsUsed, getToolsUsed, getTraceEventStats } from "@/lib/trace-utils";
import { cn } from "@/lib/utils";
import {
  Bot,
  Calendar,
  Clock,
  Hash,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Terminal,
} from "lucide-react";
import * as React from "react";

interface TraceSidebarLeftProps {
  trace: TraceDetail;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function TraceSidebarLeft({ trace, isCollapsed, onToggle }: TraceSidebarLeftProps) {
  const [openSections, setOpenSections] = React.useState<string[]>([
    "agent",
    "stats",
    "tools",
  ]);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // Calculate stats from events
  const stats = trace.events ? getTraceEventStats(trace.events) : null;
  const models = trace.events ? getModelsUsed(trace.events) : [];
  const tools = trace.events ? getToolsUsed(trace.events) : [];

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

  if (isCollapsed) {
    return (
      <div className="flex w-12 flex-col items-center border-r border-border/30 bg-background py-4 transition-all duration-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0 mb-4 hover:bg-surface-2"
        >
          <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="flex flex-col gap-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-2/50" title="Agent">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-2/50" title="Stats">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-2/50" title="Tools">
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-r border-border/30 bg-card overflow-y-auto transition-all duration-300">
      <div className="flex h-10 items-center justify-between border-b border-border/30 px-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Agent Info
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-6 w-6 p-0 hover:bg-surface-2"
        >
          <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Agent Info Section */}
        <div className="rounded-lg bg-surface-2/30 p-4 border border-border/30">
          <button
            onClick={() => toggleSection("agent")}
            className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5" />
              Agent
            </span>
          </button>

          {openSections.includes("agent") && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Name
                </label>
                <p className="text-sm font-medium text-foreground">{trace.entityName || "Unknown"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Trace ID
                </label>
                <p className="text-xs font-mono text-foreground truncate" title={trace.threadId}>
                  {trace.threadId.substring(0, 16)}...
                </p>
              </div>
              {trace.model && (
                <div>
                  <label className="text-xs text-muted-foreground">Model</label>
                  <p className="text-xs font-mono text-foreground">{trace.model}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Started
                </label>
                <p className="text-xs text-foreground">
                  {trace.firstEventTimestamp ? formatTimestamp(trace.firstEventTimestamp) : "N/A"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats Section */}
        {stats && (
          <div className="rounded-lg bg-surface-2/30 p-4 border border-border/30">
            <button
              onClick={() => toggleSection("stats")}
              className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Stats
              </span>
            </button>

            {openSections.includes("stats") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Events</label>
                  <p className="text-lg font-semibold text-foreground">{stats.totalEvents}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Duration</label>
                  <p className="text-lg font-semibold text-foreground">{trace.duration}ms</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">LLM Calls</label>
                  <p className="text-lg font-semibold text-foreground">{stats.llmCalls}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tool Calls</label>
                  <p className="text-lg font-semibold text-foreground">{stats.toolCalls}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tokens</label>
                  <p className="text-lg font-semibold text-foreground">{stats.totalTokens.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Errors</label>
                  <p className={cn("text-lg font-semibold", stats.errors > 0 ? "text-destructive" : "text-foreground")}>
                    {stats.errors}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Models Section */}
        {models.length > 0 && (
          <div className="rounded-lg bg-surface-2/30 p-4 border border-border/30">
            <button
              onClick={() => toggleSection("models")}
              className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Models ({models.length})
              </span>
            </button>

            {openSections.includes("models") && (
              <div className="space-y-2">
                {models.map((model, index) => (
                  <Badge key={index} className="text-xs font-mono bg-surface-2 text-foreground border-border">
                    {model}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tools Section */}
        {tools.length > 0 && (
          <div className="rounded-lg bg-surface-2/30 p-4 border border-border/30">
            <button
              onClick={() => toggleSection("tools")}
              className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                Tools ({tools.length})
              </span>
            </button>

            {openSections.includes("tools") && (
              <div className="space-y-2">
                {tools.map((tool, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <Terminal className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-foreground">{tool}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* System Prompt Section */}
        {trace.systemPrompt && (
          <div className="rounded-lg bg-surface-2/30 p-4 border border-border/30">
            <button
              onClick={() => toggleSection("systemPrompt")}
              className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                System Prompt
              </span>
            </button>

            {openSections.includes("systemPrompt") && (
              <div className="max-h-40 overflow-y-auto">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {trace.systemPrompt}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
