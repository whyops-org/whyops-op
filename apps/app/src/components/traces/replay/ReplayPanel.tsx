"use client";

import { Clock, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useJudgeStore } from "@/stores/judgeStore";
import { useReplayStore, type RunReplayOptions, type ReplayRun } from "@/stores/replayStore";
import { useTraceDetailStore } from "@/stores/traceDetailStore";
import { ReplayComparisonView } from "./ReplayComparison";
import { ReplayControls } from "./ReplayControls";

interface ReplayPanelProps {
  traceId: string;
}

export function ReplayPanel({ traceId }: ReplayPanelProps) {
  const {
    currentRun,
    pastRuns,
    isRunning,
    error,
    runReplay,
    fetchPastRuns,
    fetchRunDetail,
    reset,
  } = useReplayStore();

  const systemPrompt = useTraceDetailStore((s) => s.trace?.systemPrompt ?? "");
  const judgeResult = useJudgeStore((s) => s.judgeResult);
  const patches = judgeResult?.findings ?? [];
  const originalEventCount = useTraceDetailStore((s) => s.trace?.eventCount ?? 0);

  useEffect(() => {
    fetchPastRuns(traceId);
    return () => reset();
  }, [traceId, fetchPastRuns, reset]);

  useEffect(() => {
    if (error) toast.error(error, { id: "replay-error", duration: 4500 });
  }, [error]);

  const handleRun = useCallback(
    (config: RunReplayOptions["variantConfig"]) => {
      const options: RunReplayOptions = {
        analysisId: judgeResult?.id,
        variantConfig: config,
      };
      toast.loading("Starting replay…", { id: "replay-run" });
      runReplay(traceId, options).then((run) => {
        if (!run) return;
        if (run.status === "completed") {
          toast.success("Replay complete", {
            id: "replay-run",
            description: run.comparison?.summary ?? "",
            duration: 4200,
          });
        } else {
          toast.error("Replay failed", {
            id: "replay-run",
            description: run.error ?? "Unknown error",
            duration: 4200,
          });
        }
      });
    },
    [traceId, judgeResult?.id, runReplay]
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full flex-col gap-5 p-5 lg:p-6">
        <ReplayControls
          isRunning={isRunning}
          systemPrompt={systemPrompt}
          patches={patches}
          onRun={handleRun}
          historyAction={
            pastRuns.length > 0 ? (
              <HistoryMenu
                runs={pastRuns}
                currentId={currentRun?.id}
                onSelect={(id) => fetchRunDetail(id)}
              />
            ) : undefined
          }
        />

        {/* Running state */}
        {isRunning && !currentRun && (
          <section className="flex items-center justify-center gap-3 rounded-sm border border-border/60 bg-surface-2/20 py-12">
            <Spinner className="h-5 w-5 border-2 border-border border-t-foreground" />
            <span className="text-sm text-muted-foreground">Replay in progress…</span>
          </section>
        )}

        {/* Running — context built, executing */}
        {isRunning && currentRun?.status === "running" && (
          <section className="flex items-center gap-3 rounded-sm border border-primary/30 bg-primary/5 px-4 py-3">
            <Spinner className="h-4 w-4 shrink-0 border-2 border-primary/40 border-t-primary" />
            <span className="text-sm text-primary">Executing replay steps…</span>
          </section>
        )}

        {/* Result */}
        {currentRun?.status === "completed" && currentRun.comparison && currentRun.replayEvents && (
          <ReplayComparisonView
            comparison={currentRun.comparison}
            replayEvents={currentRun.replayEvents}
            originalEventCount={originalEventCount}
          />
        )}

        {currentRun?.status === "failed" && (
          <section className="rounded-sm border border-destructive/30 bg-destructive/5 px-5 py-4">
            <p className="text-sm font-semibold text-destructive">Replay failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{currentRun.error}</p>
          </section>
        )}

        {/* Empty state */}
        {!isRunning && !currentRun && (
          <section className="flex flex-col items-center rounded-sm border border-dashed border-border/70 bg-surface-2/20 px-6 py-12 text-center">
            <RefreshCw className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-lg font-semibold text-foreground">No replay yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {patches.length > 0
                ? "Judge patches are available. Click Configure & Replay to start."
                : "Run the LLM Judge first to generate patches, or replay with a custom system prompt."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

// ── History menu ───────────────────────────────────────────────────────────

interface HistoryMenuProps {
  runs: ReplayRun[];
  currentId?: string;
  onSelect: (id: string) => void;
}

function HistoryMenu({ runs, currentId, onSelect }: HistoryMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        className="h-10 gap-1.5 px-3"
        onClick={() => setIsOpen((v) => !v)}
      >
        <Clock className="h-3.5 w-3.5" />
        History ({runs.length})
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-sm border border-border/60 bg-card shadow-lg">
            <div className="max-h-64 overflow-y-auto divide-y divide-border/30">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => { onSelect(run.id); setIsOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-2/60",
                    currentId === run.id && "bg-primary/5"
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {run.id.slice(0, 12)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {run.variantConfig.patchSummary ?? "Replay"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <RunStatusBadge status={run.status} />
                    {run.score !== undefined && run.score !== null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.round(run.score * 100)}%
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const classes =
    status === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : status === "failed"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : status === "running"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/60 bg-surface-2/30 text-muted-foreground";
  return <Badge className={cn("text-[10px]", classes)}>{status}</Badge>;
}

