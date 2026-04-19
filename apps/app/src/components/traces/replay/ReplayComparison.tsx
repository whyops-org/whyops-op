"use client";

import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReplayComparison as ReplayComparisonData, ReplayEvent } from "@/stores/replayStore";

interface ReplayComparisonProps {
  comparison: ReplayComparisonData;
  replayEvents: ReplayEvent[];
  originalEventCount: number;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-sm font-semibold tabular-nums",
        pct >= 75
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : pct >= 50
            ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
            : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {pct}%
    </span>
  );
}

function StatDelta({
  label,
  original,
  replay,
  lowerIsBetter = false,
}: {
  label: string;
  original: number;
  replay: number;
  lowerIsBetter?: boolean;
}) {
  const improved = lowerIsBetter ? replay < original : replay > original;
  const same = replay === original;
  const color = same
    ? "text-muted-foreground"
    : improved
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-destructive";

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground">{original}</span>
        <ArrowRight className="h-3 w-3 text-border" />
        <span className={cn("font-medium", color)}>{replay}</span>
      </span>
    </div>
  );
}

export function ReplayComparisonView({
  comparison,
  replayEvents,
  originalEventCount,
}: ReplayComparisonProps) {
  return (
    <div className="space-y-4">
      {/* Score + summary header */}
      <section className="flex items-start justify-between gap-4 rounded-sm border border-border/60 bg-surface-2/20 px-5 py-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Replay result</p>
          <p className="text-sm text-muted-foreground">{comparison.summary}</p>
        </div>
        <ScoreBadge score={comparison.score} />
      </section>

      {/* Metrics grid */}
      <section className="rounded-sm border border-border/60 bg-surface-2/20 px-5 py-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Metrics comparison</p>
        <div className="space-y-2">
          <StatDelta label="Steps" original={comparison.originalStepCount} replay={comparison.replayStepCount} lowerIsBetter />
          <StatDelta label="Errors" original={comparison.originalErrorCount} replay={comparison.replayErrorCount} lowerIsBetter />
          <StatDelta label="Tool calls" original={comparison.originalToolCallCount} replay={comparison.replayToolCallCount} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-3">
          <StatusBadge ok={comparison.loopResolved} label="Loop resolved" />
          <StatusBadge ok={comparison.finalAnswerChanged} label="Answer changed" neutral />
          <StatusBadge ok={comparison.replayErrorCount < comparison.originalErrorCount} label="Fewer errors" />
        </div>
      </section>

      {/* Replay events */}
      <section className="rounded-sm border border-border/60 bg-surface-2/20">
        <div className="border-b border-border/40 px-5 py-3">
          <p className="text-sm font-semibold text-foreground">
            Replay trace
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {replayEvents.length} events
            </span>
          </p>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border/30">
          {replayEvents.map((event, idx) => (
            <ReplayEventRow key={idx} event={event} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({
  ok,
  label,
  neutral = false,
}: {
  ok: boolean;
  label: string;
  neutral?: boolean;
}) {
  if (neutral) {
    return (
      <Badge className="gap-1 border-border/60 bg-surface-2/30 text-muted-foreground">
        {label}
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        "gap-1",
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border/60 bg-surface-2/30 text-muted-foreground"
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

function ReplayEventRow({ event }: { event: ReplayEvent }) {
  const isError = event.eventType === "error";
  const isLLM = event.eventType === "llm_response";
  const isTool = event.eventType.includes("tool");

  const previewText = (() => {
    const c = event.content as any;
    if (!c) return "";
    if (isLLM) return String(c?.content ?? c?.text ?? "").slice(0, 120);
    if (isTool) return String(c?.toolName ?? JSON.stringify(c)).slice(0, 80);
    if (isError) return String(c?.error ?? JSON.stringify(c)).slice(0, 100);
    return String(typeof c === "string" ? c : JSON.stringify(c)).slice(0, 80);
  })();

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">
        {event.stepId}
      </span>
      <Badge
        className={cn(
          "shrink-0 font-mono text-[10px]",
          isError
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : isLLM
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border/60 bg-surface-2/30 text-muted-foreground"
        )}
      >
        {event.eventType}
      </Badge>
      {previewText && (
        <span className="min-w-0 truncate text-xs text-muted-foreground">{previewText}</span>
      )}
    </div>
  );
}
