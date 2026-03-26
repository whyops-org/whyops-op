"use client";

import { FileSearch } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ALL_DIMENSIONS,
  useJudgeStore,
  type JudgeDimension,
  type RunJudgeOptions,
} from "@/stores/judgeStore";
import { useTraceDetailStore } from "@/stores/traceDetailStore";
import { JudgeHistorySidebar } from "./JudgeHistorySidebar";
import { JudgeResults } from "./JudgeResults";
import { JudgeResultsSkeleton } from "./JudgeResultsSkeleton";
import { RunControls } from "./RunControls";
import type { JudgeMode } from "./types";
import { formatCheckpointToastCopy } from "./utils";

interface JudgePanelProps {
  traceId: string;
}

const EMPTY_TOOLS: unknown[] = [];

export function JudgePanel({ traceId }: JudgePanelProps) {
  const {
    judgeResult,
    pastAnalyses,
    isRunning,
    isLoading,
    error,
    runJudge,
    fetchPastAnalyses,
    fetchAnalysisDetail,
    reset,
  } = useJudgeStore();

  const systemPrompt = useTraceDetailStore((state) => state.trace?.systemPrompt || "");
  const traceTools = useTraceDetailStore((state) => state.trace?.tools);
  const tools = traceTools ?? EMPTY_TOOLS;

  const [selectedDimensions, setSelectedDimensions] = useState<JudgeDimension[]>([...ALL_DIMENSIONS]);
  const [mode, setMode] = useState<JudgeMode>("standard");
  const latestCheckpoint = judgeResult?.summary?.checkpoint;
  const hasJudgeResult = Boolean(judgeResult);
  const showStreamingSkeleton = isRunning && !hasJudgeResult;
  const showRunArea = isRunning || hasJudgeResult;
  const previousRunningRef = useRef(false);
  const lastCheckpointRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    fetchPastAnalyses(traceId);
    return () => reset();
  }, [traceId, fetchPastAnalyses, reset]);

  useEffect(() => {
    return () => {
      toast.dismiss("judge-run");
    };
  }, []);

  useEffect(() => {
    const checkpointId = latestCheckpoint
      ? `${latestCheckpoint.key}:${latestCheckpoint.sequence}`
      : null;
    const status = judgeResult?.status?.toLowerCase();

    if (isRunning && !previousRunningRef.current) {
      toast.loading("Running judge analysis", {
        id: "judge-run",
        description: "Streaming checkpoints and partial findings.",
      });
    }

    if (isRunning && latestCheckpoint && checkpointId && checkpointId !== lastCheckpointRef.current) {
      const checkpointToast = formatCheckpointToastCopy(
        latestCheckpoint.key,
        latestCheckpoint.sequence
      );

      toast.loading(checkpointToast.title, {
        id: "judge-run",
        description: checkpointToast.description,
      });
      lastCheckpointRef.current = checkpointId;
    }

    if (!isRunning && previousRunningRef.current) {
      if (status === "completed" && judgeResult) {
        toast.success("Analysis complete", {
          id: "judge-run",
          description: `${judgeResult.summary.totalIssues} issues - ${judgeResult.summary.totalPatches} patches`,
          duration: 4200,
        });
      } else if (status === "failed") {
        toast.error("Analysis failed", {
          id: "judge-run",
          description: "Please retry with fewer dimensions or a different mode.",
          duration: 4200,
        });
      } else {
        toast.dismiss("judge-run");
      }
      lastCheckpointRef.current = null;
    }

    previousRunningRef.current = isRunning;
  }, [isRunning, judgeResult, latestCheckpoint]);

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = null;
      return;
    }

    if (lastErrorRef.current === error) {
      return;
    }

    toast.error(error, { id: "judge-error", duration: 4500 });
    lastErrorRef.current = error;
  }, [error]);

  const handleRun = useCallback(() => {
    const options: RunJudgeOptions = {
      dimensions:
        selectedDimensions.length < ALL_DIMENSIONS.length ? selectedDimensions : undefined,
      mode,
    };
    runJudge(traceId, options);
  }, [traceId, selectedDimensions, mode, runJudge]);

  const toggleDimension = (dimension: JudgeDimension) => {
    setSelectedDimensions((prev) =>
      prev.includes(dimension)
        ? prev.filter((existingDimension) => existingDimension !== dimension)
        : [...prev, dimension]
    );
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full flex-col gap-5 p-5 lg:p-6">
        <RunControls
          selectedDimensions={selectedDimensions}
          mode={mode}
          onModeChange={setMode}
          onToggleDimension={toggleDimension}
          onRun={handleRun}
          isRunning={isRunning}
          historyAction={
            <JudgeHistorySidebar
              analyses={pastAnalyses}
              currentId={judgeResult?.id}
              onSelect={fetchAnalysisDetail}
              isLoading={isLoading}
              isRunning={isRunning}
            />
          }
        />

        {showRunArea ? (
          <div className="space-y-5">
            {judgeResult ? (
              <JudgeResults
                result={judgeResult}
                systemPrompt={systemPrompt}
                tools={tools}
                isStreaming={isRunning}
              />
            ) : null}

            {showStreamingSkeleton ? <JudgeResultsSkeleton /> : null}
          </div>
        ) : (
          <section className="rounded-sm border border-dashed border-border/70 bg-surface-2/20 px-6 py-10 text-center">
            <FileSearch className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-lg font-semibold text-foreground">No analysis selected yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use Configure &amp; Run to start a judge pass for this trace.
            </p>
          </section>
        )}

      </div>
    </div>
  );
}
