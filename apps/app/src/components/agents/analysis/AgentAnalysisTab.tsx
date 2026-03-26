"use client";

import { FileSearch } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AGENT_ANALYSIS_ALL_DIMENSIONS,
  AGENT_ANALYSIS_LOOKBACK_OPTIONS,
  type AgentAnalysisDimension,
  type AgentAnalysisMode,
} from "@/constants/agent-analysis";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAgentAnalysisStore } from "@/stores/agentAnalysisStore";
import { AnalysisHistorySheet } from "./AnalysisHistorySheet";
import { AnalysisResults } from "./AnalysisResults";
import { AnalysisRunControls, type AgentAnalysisScheduleDraft } from "./AnalysisRunControls";
import { formatAgentCheckpointCopy } from "./utils";

interface AgentAnalysisTabProps {
  agentId: string;
}

const DEFAULT_LOOKBACK_DAYS = AGENT_ANALYSIS_LOOKBACK_OPTIONS[1]?.value || 14;

const DEFAULT_SCHEDULE_DRAFT: AgentAnalysisScheduleDraft = {
  enabled: false,
  preset: "daily",
  cronExpr: "0 9 * * *",
  timezone: "UTC",
  judgeModel: "",
  dimensions: AGENT_ANALYSIS_ALL_DIMENSIONS,
};

function scheduleStorageKey(agentId: string): string {
  return `whyops-agent-analysis-schedule:${agentId}`;
}

function loadScheduleDraft(agentId: string): AgentAnalysisScheduleDraft {
  if (typeof window === "undefined") {
    return DEFAULT_SCHEDULE_DRAFT;
  }

  try {
    const raw = window.localStorage.getItem(scheduleStorageKey(agentId));
    if (!raw) return DEFAULT_SCHEDULE_DRAFT;
    const parsed = JSON.parse(raw) as Partial<AgentAnalysisScheduleDraft>;
    const parsedDimensions = Array.isArray(parsed.dimensions)
      ? parsed.dimensions.filter((dimension): dimension is AgentAnalysisDimension =>
          AGENT_ANALYSIS_ALL_DIMENSIONS.includes(dimension as AgentAnalysisDimension)
        )
      : [];

    return {
      enabled: Boolean(parsed.enabled),
      preset:
        parsed.preset === "daily" || parsed.preset === "weekdays" || parsed.preset === "custom"
          ? parsed.preset
          : DEFAULT_SCHEDULE_DRAFT.preset,
      cronExpr:
        typeof parsed.cronExpr === "string" && parsed.cronExpr.trim().length > 0
          ? parsed.cronExpr
          : DEFAULT_SCHEDULE_DRAFT.cronExpr,
      timezone:
        typeof parsed.timezone === "string" && parsed.timezone.trim().length > 0
          ? parsed.timezone
          : DEFAULT_SCHEDULE_DRAFT.timezone,
      judgeModel:
        typeof parsed.judgeModel === "string" ? parsed.judgeModel : DEFAULT_SCHEDULE_DRAFT.judgeModel,
      dimensions: parsedDimensions.length > 0 ? parsedDimensions : DEFAULT_SCHEDULE_DRAFT.dimensions,
    };
  } catch {
    return DEFAULT_SCHEDULE_DRAFT;
  }
}

export function AgentAnalysisTab({ agentId }: AgentAnalysisTabProps) {
  const {
    currentRun,
    configRecord,
    runs,
    pagination,
    isRunning,
    isLoading,
    isHistoryLoading,
    isConfigSaving,
    error,
    runAnalysis,
    fetchConfig,
    saveConfig,
    fetchLatestRun,
    fetchRuns,
    fetchRunById,
    reset,
  } = useAgentAnalysisStore();

  const [mode, setMode] = useState<AgentAnalysisMode>("standard");
  const [lookbackDays, setLookbackDays] = useState<number>(DEFAULT_LOOKBACK_DAYS);
  const [scheduleDraft, setScheduleDraft] = useState<AgentAnalysisScheduleDraft>(() =>
    loadScheduleDraft(agentId)
  );
  const [judgeModel, setJudgeModel] = useState<string>(scheduleDraft.judgeModel || "");
  const [selectedDimensions, setSelectedDimensions] = useState<AgentAnalysisDimension[]>(
    scheduleDraft.dimensions && scheduleDraft.dimensions.length > 0
      ? scheduleDraft.dimensions
      : AGENT_ANALYSIS_ALL_DIMENSIONS
  );
  const previousRunningRef = useRef(false);
  const lastCheckpointRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const checkpoint = currentRun?.summary?.checkpoint;

  useEffect(() => {
    fetchLatestRun(agentId);
    fetchRuns(agentId, 1, pagination.count || 20);
    fetchConfig(agentId).then((config) => {
      if (!config) return;

      const persistedMode = config.samplingConfig?.mode;
      const persistedJudgeModel = config.samplingConfig?.judgeModel;
      const persistedDimensions = config.samplingConfig?.dimensions;
      const validDimensions = Array.isArray(persistedDimensions)
        ? persistedDimensions.filter((dimension): dimension is AgentAnalysisDimension =>
            AGENT_ANALYSIS_ALL_DIMENSIONS.includes(dimension)
          )
        : [];

      if (persistedMode === "quick" || persistedMode === "standard" || persistedMode === "deep") {
        setMode(persistedMode);
      }
      if (typeof persistedJudgeModel === "string") {
        setJudgeModel(persistedJudgeModel);
      }
      if (validDimensions.length > 0) {
        setSelectedDimensions(validDimensions);
      }

      setLookbackDays(config.lookbackDays);
      setScheduleDraft((previous) => ({
        ...previous,
        enabled: config.enabled,
        cronExpr: config.cronExpr,
        timezone: config.timezone,
        judgeModel: typeof persistedJudgeModel === "string" ? persistedJudgeModel : previous.judgeModel,
        dimensions: validDimensions.length > 0 ? validDimensions : previous.dimensions,
      }));
    });
    return () => reset();
  }, [agentId, fetchConfig, fetchLatestRun, fetchRuns, pagination.count, reset]);

  useEffect(() => {
    return () => {
      toast.dismiss("agent-analysis-run");
    };
  }, []);

  useEffect(() => {
    const checkpointId = checkpoint ? `${checkpoint.key}:${checkpoint.sequence}` : null;
    const status = currentRun?.status;

    if (isRunning && !previousRunningRef.current) {
      toast.loading("Running agent analysis", {
        id: "agent-analysis-run",
        description: "Streaming checkpoints and section updates.",
      });
    }

    if (isRunning && checkpoint && checkpointId && checkpointId !== lastCheckpointRef.current) {
      const copy = formatAgentCheckpointCopy(checkpoint.key, checkpoint.sequence);
      toast.loading(copy.title, {
        id: "agent-analysis-run",
        description: copy.description,
      });
      lastCheckpointRef.current = checkpointId;
    }

    if (!isRunning && previousRunningRef.current) {
      if (status === "completed" && currentRun) {
        toast.success("Agent analysis complete", {
          id: "agent-analysis-run",
          description: `${currentRun.traceCount} traces analyzed across ${currentRun.eventCount} events`,
          duration: 4200,
        });
      } else if (status === "failed") {
        toast.error("Agent analysis failed", {
          id: "agent-analysis-run",
          description: currentRun?.error || "Please retry with a smaller window.",
          duration: 4200,
        });
      } else {
        toast.dismiss("agent-analysis-run");
      }
      lastCheckpointRef.current = null;
    }

    previousRunningRef.current = isRunning;
  }, [checkpoint, currentRun, isRunning]);

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = null;
      return;
    }

    if (lastErrorRef.current === error) return;
    toast.error(error, { id: "agent-analysis-error", duration: 4500 });
    lastErrorRef.current = error;
  }, [error]);

  const saveScheduleDraft = useCallback(() => {
    const nextDraft: AgentAnalysisScheduleDraft = {
      ...scheduleDraft,
      judgeModel,
      dimensions: selectedDimensions,
    };
    setScheduleDraft(nextDraft);
    window.localStorage.setItem(scheduleStorageKey(agentId), JSON.stringify(nextDraft));
  }, [agentId, judgeModel, scheduleDraft, selectedDimensions]);

  const saveRemoteConfig = useCallback(async () => {
    const result = await saveConfig(agentId, {
      enabled: scheduleDraft.enabled,
      cronExpr: scheduleDraft.cronExpr,
      timezone: scheduleDraft.timezone,
      lookbackDays,
      mode,
      judgeModel: judgeModel.trim() || undefined,
      dimensions: selectedDimensions,
    });

    if (result) {
      toast.success("Agent analysis config saved");
    }
  }, [
    agentId,
    judgeModel,
    lookbackDays,
    mode,
    saveConfig,
    scheduleDraft.cronExpr,
    scheduleDraft.enabled,
    scheduleDraft.timezone,
    selectedDimensions,
  ]);

  const handleRun = useCallback(async () => {
    await runAnalysis(agentId, {
      mode,
      lookbackDays,
      judgeModel: judgeModel.trim() || undefined,
      dimensions: selectedDimensions,
    });
    await fetchRuns(agentId, 1, pagination.count || 20);
  }, [
    agentId,
    fetchRuns,
    judgeModel,
    lookbackDays,
    mode,
    pagination.count,
    runAnalysis,
    selectedDimensions,
  ]);

  const handleSelectRun = useCallback(
    (runId: string) => {
      fetchRunById(runId);
    },
    [fetchRunById]
  );

  const handleHistoryOpen = useCallback(() => {
    fetchRuns(agentId, pagination.page || 1, pagination.count || 20);
  }, [agentId, fetchRuns, pagination.count, pagination.page]);

  const handleHistoryPageChange = useCallback(
    (page: number) => {
      fetchRuns(agentId, page, pagination.count || 20);
    },
    [agentId, fetchRuns, pagination.count]
  );

  const showEmptyState = !isLoading && !currentRun && !isRunning;
  const showStreamingSkeleton = isRunning && !currentRun;

  const historyAction = useMemo(
    () => (
      <AnalysisHistorySheet
        runs={runs}
        currentRunId={currentRun?.id}
        isLoading={isHistoryLoading}
        isRunning={isRunning}
        pagination={pagination}
        onSelect={handleSelectRun}
        onOpen={handleHistoryOpen}
        onPageChange={handleHistoryPageChange}
      />
    ),
    [
      currentRun?.id,
      handleHistoryOpen,
      handleHistoryPageChange,
      handleSelectRun,
      isHistoryLoading,
      isRunning,
      pagination,
      runs,
    ]
  );

  return (
    <div className="space-y-6">
      <AnalysisRunControls
        mode={mode}
        lookbackDays={lookbackDays}
        judgeModel={judgeModel}
        selectedDimensions={selectedDimensions}
        scheduleDraft={scheduleDraft}
        onModeChange={setMode}
        onLookbackDaysChange={setLookbackDays}
        onJudgeModelChange={setJudgeModel}
        onSelectedDimensionsChange={setSelectedDimensions}
        onScheduleDraftChange={setScheduleDraft}
        onSaveScheduleDraft={saveScheduleDraft}
        onSaveRemoteConfig={saveRemoteConfig}
        onRun={handleRun}
        isRunning={isRunning}
        isConfigSaving={isConfigSaving}
        hasPersistedConfig={Boolean(configRecord)}
        historyAction={historyAction}
      />

      {currentRun ? <AnalysisResults run={currentRun} isStreaming={isRunning} /> : null}

      {showStreamingSkeleton ? (
        <Card className="border-border/60 bg-card px-6 py-10 text-center">
          <Spinner className="mx-auto h-7 w-7 border-2 border-border border-t-foreground" />
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Preparing overview sections. Results will stream in this panel.
          </p>
        </Card>
      ) : null}

      {showEmptyState ? (
        <section className="rounded-sm border border-dashed border-border/70 bg-surface-2/20 px-6 py-12 text-center">
          <FileSearch className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 text-xl font-semibold text-foreground">No agent analysis yet</p>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Use Configure &amp; Run to generate a full overview for this agent.
          </p>
        </section>
      ) : null}
    </div>
  );
}
