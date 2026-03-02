"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TraceDetail } from "@/stores/traceDetailStore";
import { calculateTraceCost, formatCostUsd, getPrimaryCostRate } from "@/lib/trace-cost";
import { formatDuration } from "@/lib/trace-format";
import { cn } from "@/lib/utils";
import {
  Clock,
  Cpu,
  GitGraph,
  List,
  RefreshCw,
  Scale,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface TraceHeaderProps {
  trace: TraceDetail;
  view: "graph" | "timeline" | "judge";
  onViewChange: (view: "graph" | "timeline" | "judge") => void;
  agentId?: string;
}

export function TraceHeader({ trace, view, onViewChange, agentId }: TraceHeaderProps) {
  const hasErrors = trace.errorCount > 0;
  const statusLabel = hasErrors ? "Error" : "Healthy";
  const duration = formatDuration(trace.duration);

  const pricing = getPrimaryCostRate(trace.cost ?? null);
  const { total } = calculateTraceCost(trace.events ?? [], pricing);
  const cost = formatCostUsd(total);
  const agentHref = agentId
    ? `/agents/${agentId}`
      : trace.agentId
      ? `/agents/${trace.agentId}`
      : trace.entityId
      ? `/agents/${trace.entityId}`
      : "/agents";

  return (
    <div className="flex h-14 items-center justify-between border-b border-border/50 bg-background px-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 items-center text-sm font-medium text-muted-foreground">
          <Link
            href="/agents"
            className="truncate transition-colors hover:text-foreground"
          >
            Agents
          </Link>
          <span className="mx-2 text-border">/</span>
          <Link
            href={agentHref}
            className="truncate transition-colors hover:text-foreground"
          >
            {trace.entityName || "Agent"}
          </Link>
          <span className="mx-2 text-border">/</span>
          <span className="truncate text-foreground">{trace.threadId.substring(0, 16)}...</span>
        </div>

        <Badge
          className={cn(
            "h-5 px-1.5 text-[10px] uppercase tracking-wide",
            hasErrors
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border/70 bg-surface-2/50 text-foreground"
          )}
        >
          {statusLabel}
        </Badge>

        <div className="hidden items-center gap-2 lg:flex">
          <MetricPill icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={duration} />
          <MetricPill label="Cost" value={cost} />
          <MetricPill icon={<RefreshCw className="h-3.5 w-3.5 rotate-90" />} label="Tokens" value={trace.totalTokens.toLocaleString()} />
          <MetricPill icon={<Cpu className="h-3.5 w-3.5" />} label="Model" value={trace.model || "N/A"} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-sm border border-border/60 bg-card p-0.5">
          <ViewToggleButton
            active={view === "graph"}
            onClick={() => onViewChange("graph")}
            label="Graph"
            icon={<GitGraph className="h-3.5 w-3.5" />}
          />
          <ViewToggleButton
            active={view === "timeline"}
            onClick={() => onViewChange("timeline")}
            label="Timeline"
            icon={<List className="h-3.5 w-3.5" />}
          />
          <ViewToggleButton
            active={view === "judge"}
            onClick={() => onViewChange("judge")}
            label="Judge"
            icon={<Scale className="h-3.5 w-3.5" />}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Replay
        </Button>
      </div>
    </div>
  );
}

interface MetricPillProps {
  label: string;
  value: string;
  icon?: ReactNode;
}

function MetricPill({ label, value, icon }: MetricPillProps) {
  return (
    <div className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border/60 bg-surface-2/30 px-2.5 text-xs">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[9rem] truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

interface ViewToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}

function ViewToggleButton({ active, onClick, label, icon }: ViewToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
