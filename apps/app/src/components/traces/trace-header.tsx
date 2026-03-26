"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCostUsd, getPrimaryCostRate, getTraceTotalCost } from "@/lib/trace-cost";
import { formatDuration } from "@/lib/trace-format";
import type { TraceModelBreakdown } from "@/stores/traceDetailStore";
import type { TraceDetail } from "@/stores/traceDetailStore";
import { cn } from "@/lib/utils";
import {
  Clock,
  Cpu,
  DollarSign,
  GitGraph,
  Hash,
  Layers,
  List,
  RefreshCw,
  Scale,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

interface TraceHeaderProps {
  trace: TraceDetail;
  view: "graph" | "timeline" | "judge";
  onViewChange: (view: "graph" | "timeline" | "judge") => void;
  agentId?: string;
}

export function TraceHeader({ trace, view, onViewChange, agentId }: TraceHeaderProps) {
  const hasErrors = trace.errorCount > 0;
  const statusLabel = hasErrors ? "Error" : "Healthy";

  const pricing = getPrimaryCostRate(trace.cost ?? null);
  const totalCostValue = getTraceTotalCost(trace.totalCost, trace.events ?? [], pricing);

  const modelBreakdowns = trace.models ?? [];
  const lastBreakdown = modelBreakdowns.find((m) => m.isLastModel);
  const totalUsedTokens =
    modelBreakdowns.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0) ||
    trace.totalTokens;
  const lastContextWindow = lastBreakdown?.cost?.contextWindow
    ? Number(lastBreakdown.cost.contextWindow)
    : null;
  const ctxFillPct =
    lastContextWindow && lastContextWindow > 0
      ? Math.min(totalUsedTokens / lastContextWindow, 1)
      : null;

  const agentHref = agentId
    ? `/agents/${agentId}`
    : trace.agentId
    ? `/agents/${trace.agentId}`
    : trace.entityId
    ? `/agents/${trace.entityId}`
    : "/agents";

  return (
    <div className="flex h-12 items-center justify-between border-b border-border/50 bg-background px-4 lg:px-5">
      {/* Left: breadcrumb + status */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 items-center text-sm font-medium text-muted-foreground">
          <Link href="/agents" className="truncate transition-colors hover:text-foreground">
            Agents
          </Link>
          <span className="mx-1.5 text-border">/</span>
          <Link href={agentHref} className="truncate transition-colors hover:text-foreground">
            {trace.entityName || "Agent"}
          </Link>
          <span className="mx-1.5 text-border">/</span>
          <span className="truncate text-foreground">{trace.threadId.substring(0, 16)}…</span>
        </div>

        <Badge
          className={cn(
            "h-5 px-1.5 text-[10px]",
            hasErrors
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border/60 bg-transparent text-muted-foreground"
          )}
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Center: icon metrics */}
      <div className="hidden items-center gap-0.5 lg:flex">
        <HoverMetric icon={<Clock className="h-3.5 w-3.5" />}>
          <PopoverRow label="Duration" value={formatDuration(trace.duration)} />
        </HoverMetric>

        <HoverMetric icon={<DollarSign className="h-3.5 w-3.5" />}>
          <PopoverRow label="Total cost" value={formatCostUsd(totalCostValue)} />
          {modelBreakdowns.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
              {modelBreakdowns.map((m) => (
                <ModelCostRow key={m.model} breakdown={m} />
              ))}
            </div>
          )}
        </HoverMetric>

        <HoverMetric icon={<Hash className="h-3.5 w-3.5" />}>
          <PopoverRow label="Total tokens" value={trace.totalTokens.toLocaleString()} />
          {modelBreakdowns.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
              {modelBreakdowns.map((m) => (
                <div key={m.model} className="flex items-center justify-between gap-4 text-xs">
                  <span className="truncate font-mono text-muted-foreground">{m.model}</span>
                  <span className="tabular-nums text-foreground">{m.totalTokens.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </HoverMetric>

        <HoverMetric icon={<Cpu className="h-3.5 w-3.5" />}>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Models{modelBreakdowns.length > 1 ? ` (${modelBreakdowns.length})` : ""}
          </p>
          {modelBreakdowns.length > 0 ? (
            <div className="space-y-1">
              {modelBreakdowns.map((m) => (
                <div key={m.model} className="flex items-center gap-2 text-xs">
                  <span className="truncate font-mono text-foreground">{m.model}</span>
                  {m.isLastModel && (
                    <span className="shrink-0 rounded border border-border/50 px-1 py-0.5 text-[10px] text-muted-foreground">
                      last
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-foreground">{trace.model ?? "N/A"}</span>
          )}
        </HoverMetric>

        {lastContextWindow !== null && (
          <HoverMetric icon={<Layers className="h-3.5 w-3.5" />}>
            <PopoverRow
              label="Context used"
              value={`${totalUsedTokens.toLocaleString()} / ${(lastContextWindow / 1000).toFixed(0)}k`}
            />
            {ctxFillPct !== null && (
              <>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-sm bg-border/40">
                  <div
                    className="h-full bg-foreground/30 transition-all"
                    style={{ width: `${(ctxFillPct * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                  {(ctxFillPct * 100).toFixed(1)}%
                </p>
              </>
            )}
            {lastBreakdown && (
              <p className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground">
                {lastBreakdown.model}
              </p>
            )}
          </HoverMetric>
        )}
      </div>

      {/* Right: view toggle + replay */}
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

        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Replay
        </Button>
      </div>
    </div>
  );
}

// ── Icon metric button with hover popover ──────────────────────────────────

interface HoverMetricProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

function HoverMetric({ icon, children }: HoverMetricProps) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2/50 hover:text-foreground"
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={4}
        className="w-56 p-3"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function PopoverRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium text-foreground">{value}</span>
    </div>
  );
}

function ModelCostRow({ breakdown }: { breakdown: TraceModelBreakdown }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
        {breakdown.model}
      </span>
      <span className="tabular-nums text-foreground">
        {breakdown.totalCost > 0 ? formatCostUsd(breakdown.totalCost) : "—"}
      </span>
    </div>
  );
}

// ── View toggle ────────────────────────────────────────────────────────────

interface ViewToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}

function ViewToggleButton({ active, onClick, label, icon }: ViewToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors",
        active ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
