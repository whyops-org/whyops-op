"use client";

import { Badge } from "@/components/ui/badge";
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
  view: "graph" | "timeline" | "judge" | "replay";
  onViewChange: (view: "graph" | "timeline" | "judge" | "replay") => void;
  agentId?: string;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCacheSubline(m: TraceModelBreakdown): string | null {
  const parts: string[] = [];
  if (m.cacheCreationTokens > 0) parts.push(`${fmtTokens(m.cacheCreationTokens)} write`);
  if (m.cacheReadTokens > 0) parts.push(`${fmtTokens(m.cacheReadTokens)} cached`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function TraceHeader({ trace, view, onViewChange, agentId }: TraceHeaderProps) {
  const hasErrors = trace.errorCount > 0;

  const pricing = getPrimaryCostRate(trace.cost ?? null);
  const totalCostValue = getTraceTotalCost(trace.totalCost, trace.events ?? [], pricing);

  const modelBreakdowns = trace.models ?? [];
  const lastBreakdown = modelBreakdowns.find((m) => m.isLastModel);
  const totalUsedTokens =
    modelBreakdowns.reduce(
      (sum, m) => sum + m.inputTokens + m.cacheCreationTokens + m.cacheReadTokens + m.outputTokens,
      0
    ) || trace.totalTokens;
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

  const primaryModel =
    lastBreakdown?.model ?? modelBreakdowns[0]?.model ?? trace.model ?? null;

  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 sm:px-4 lg:px-5">

      {/* Left: breadcrumb + status */}
      <div className="flex min-w-0 items-center gap-2.5">
        <nav className="flex min-w-0 items-center text-xs text-muted-foreground sm:text-sm">
          <Link href="/agents" className="shrink-0 transition-colors hover:text-foreground">
            Agents
          </Link>
          <span className="mx-1.5 text-border/80">/</span>
          <Link href={agentHref} className="truncate transition-colors hover:text-foreground">
            {trace.entityName || "Agent"}
          </Link>
          <span className="mx-1.5 text-border/80">/</span>
          <span className="hidden shrink-0 font-mono text-xs text-foreground sm:inline">
            {trace.threadId.substring(0, 14)}
          </span>
        </nav>

        <Badge
          className={cn(
            "px-1.5 text-[10px] font-normal",
            hasErrors
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "bg-transparent text-muted-foreground"
          )}
        >
          {hasErrors ? "error" : "ok"}
        </Badge>
      </div>

      {/* Center: inline metrics with hover popovers */}
      <div className="hidden items-center divide-x divide-border lg:flex">

        <MetricButton icon={<Clock className="h-3 w-3" />} value={formatDuration(trace.duration)}>
          <Row label="Duration" value={formatDuration(trace.duration)} />
          <Row label="Events" value={trace.eventCount.toLocaleString()} />
        </MetricButton>

        <MetricButton
          icon={<DollarSign className="h-3 w-3" />}
          value={totalCostValue > 0 ? formatCostUsd(totalCostValue) : "—"}
        >
          <Row label="Total" value={totalCostValue > 0 ? formatCostUsd(totalCostValue) : "—"} />
          {modelBreakdowns.length > 0 && (
            <div className="mt-2 space-y-2 border-t border-border pt-2">
              {modelBreakdowns.map((m) => (
                <CostModelRow key={m.model} breakdown={m} />
              ))}
            </div>
          )}
        </MetricButton>

        <MetricButton
          icon={<Hash className="h-3 w-3" />}
          value={fmtTokens(totalUsedTokens)}
        >
          <Row label="Total tokens" value={totalUsedTokens.toLocaleString()} />
          {modelBreakdowns.length > 0 && (
            <div className="mt-2 space-y-2 border-t border-border pt-2">
              {modelBreakdowns.map((m) => (
                <TokenModelRow key={m.model} breakdown={m} />
              ))}
            </div>
          )}
        </MetricButton>

        <MetricButton
          icon={<Cpu className="h-3 w-3" />}
          value={
            primaryModel
              ? primaryModel.split("-").slice(0, 2).join("-")
              : "—"
          }
        >
          {modelBreakdowns.length > 0 ? (
            <div className="space-y-1.5">
              {modelBreakdowns.map((m) => (
                <div key={m.model} className="flex items-baseline justify-between gap-6 text-xs">
                  <span className="truncate font-mono text-foreground">{m.model}</span>
                  {m.isLastModel && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">active</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-foreground font-mono">{trace.model ?? "—"}</span>
          )}
        </MetricButton>

        {lastContextWindow !== null && ctxFillPct !== null && (
          <MetricButton
            icon={<Layers className="h-3 w-3" />}
            value={`${(ctxFillPct * 100).toFixed(0)}%`}
          >
            <Row
              label="Context used"
              value={`${fmtTokens(totalUsedTokens)} / ${fmtTokens(lastContextWindow)}`}
            />
            <div className="mt-2 h-0.5 w-full bg-border">
              <div
                className="h-full bg-foreground/40"
                style={{ width: `${(ctxFillPct * 100).toFixed(1)}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-mono truncate">{lastBreakdown?.model}</span>
              <span className="tabular-nums">{(ctxFillPct * 100).toFixed(1)}%</span>
            </div>
          </MetricButton>
        )}
      </div>

      {/* Right: view toggle + replay */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex max-w-full items-center overflow-x-auto rounded border border-border bg-card p-0.5">
          <ViewToggleButton active={view === "graph"} onClick={() => onViewChange("graph")} label="Graph" icon={<GitGraph className="h-3.5 w-3.5" />} />
          <ViewToggleButton active={view === "timeline"} onClick={() => onViewChange("timeline")} label="Timeline" icon={<List className="h-3.5 w-3.5" />} />
          <ViewToggleButton active={view === "judge"} onClick={() => onViewChange("judge")} label="Judge" icon={<Scale className="h-3.5 w-3.5" />} />
          <ViewToggleButton active={view === "replay"} onClick={() => onViewChange("replay")} label="Replay" icon={<RefreshCw className="h-3.5 w-3.5" />} />
        </div>
      </div>
    </div>
  );
}

// ── Metric button with popover ─────────────────────────────────────────────

interface MetricButtonProps {
  icon: React.ReactNode;
  value: string;
  children: React.ReactNode;
}

function MetricButton({ icon, value, children }: MetricButtonProps) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="flex h-11 items-center gap-1.5 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {icon}
          <span className="tabular-nums">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={0}
        className="w-60 p-3"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

// ── Popover content helpers ────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium text-foreground">{value}</span>
    </div>
  );
}

function CostModelRow({ breakdown }: { breakdown: TraceModelBreakdown }) {
  const cacheReadPrice =
    breakdown.cost?.cacheReadTokenPricePerMillionToken ??
    breakdown.cost?.cachedTokenPricePerMillionToken ?? 0;
  const inputPrice = breakdown.cost?.inputTokenPricePerMillionToken ?? 0;
  const cacheSavings =
    breakdown.cacheReadTokens > 0 && inputPrice > cacheReadPrice
      ? ((inputPrice - cacheReadPrice) * breakdown.cacheReadTokens) / 1_000_000
      : 0;

  const cacheSubline = fmtCacheSubline(breakdown);

  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-4 text-xs">
        <span className="min-w-0 truncate font-mono text-foreground">{breakdown.model}</span>
        <span className="shrink-0 tabular-nums text-foreground">
          {breakdown.totalCost > 0 ? formatCostUsd(breakdown.totalCost) : "—"}
        </span>
      </div>
      {cacheSubline && (
        <div className="flex items-baseline justify-between gap-4 text-[11px] text-muted-foreground">
          <span>{cacheSubline}</span>
          {cacheSavings > 0.000001 && (
            <span className="shrink-0 tabular-nums text-emerald-600 dark:text-emerald-500">
              −{formatCostUsd(cacheSavings)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TokenModelRow({ breakdown }: { breakdown: TraceModelBreakdown }) {
  const hasCaching = breakdown.cacheCreationTokens > 0 || breakdown.cacheReadTokens > 0;
  const parts: string[] = [];
  if (hasCaching) {
    parts.push(`${fmtTokens(breakdown.inputTokens)} in`);
    if (breakdown.cacheCreationTokens > 0) parts.push(`${fmtTokens(breakdown.cacheCreationTokens)} write`);
    if (breakdown.cacheReadTokens > 0) parts.push(`${fmtTokens(breakdown.cacheReadTokens)} cached`);
    parts.push(`${fmtTokens(breakdown.outputTokens)} out`);
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-4 text-xs">
        <span className="min-w-0 truncate font-mono text-foreground">{breakdown.model}</span>
        <span className="shrink-0 tabular-nums text-foreground">{breakdown.totalTokens.toLocaleString()}</span>
      </div>
      {hasCaching && (
        <p className="text-[11px] text-muted-foreground">{parts.join(" · ")}</p>
      )}
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
        "flex h-7 shrink-0 items-center gap-1.5 rounded-sm px-2 text-xs font-medium transition-colors sm:px-2.5",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
