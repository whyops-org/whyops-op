"use client";

import { Brain, FlaskConical } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EVAL_ALL_CATEGORIES, type EvalCategory } from "@/constants/agent-evals";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentEvalsStore } from "@/stores/agentEvalsStore";
import { EvalsHistorySheet } from "./EvalsHistorySheet";
import { EvalsResults } from "./EvalsResults";
import { EvalsRunControls, type EvalScheduleDraft } from "./EvalsRunControls";
import { KnowledgeProfileView } from "./KnowledgeProfileView";

interface AgentEvalsTabProps {
  agentId: string;
}

const DEFAULT_SCHEDULE_DRAFT: EvalScheduleDraft = {
  enabled: false,
  preset: "weekly",
  cronExpr: "0 2 * * 1",
  timezone: "UTC",
};

const TOAST_ID = "agent-evals-run";

export function AgentEvalsTab({ agentId }: AgentEvalsTabProps) {
  const {
    currentRun,
    configRecord,
    knowledgeProfile,
    runs,
    pagination,
    currentCheckpoint,
    isRunning,
    isIntelligenceBuilding,
    isLoading,
    isHistoryLoading,
    isConfigSaving,
    isExporting,
    isKnowledgeLoading,
    error,
    generateEvals,
    fetchLatestRun,
    fetchRuns,
    fetchRunById,
    fetchConfig,
    saveConfig,
    fetchKnowledgeProfile,
    rebuildKnowledge,
    exportJson,
    exportPromptfoo,
    reset,
  } = useAgentEvalsStore();

  const [selectedCategories, setSelectedCategories] = useState<EvalCategory[]>(EVAL_ALL_CATEGORIES);
  const [maxEvalsPerRun, setMaxEvalsPerRun] = useState(50);
  const [customPrompt, setCustomPrompt] = useState("");
  const [judgeModel, setJudgeModel] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState<EvalScheduleDraft>(DEFAULT_SCHEDULE_DRAFT);
  const [subTab, setSubTab] = useState<"evals" | "knowledge">("evals");

  const previousRunningRef = useRef(false);
  const previousIntelligenceBuildingRef = useRef(false);
  const lastCheckpointRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchLatestRun(agentId);
    fetchRuns(agentId, 1, 20);
    fetchKnowledgeProfile(agentId);
    fetchConfig(agentId).then((config) => {
      if (!config) return;
      if (config.categories?.length) setSelectedCategories(config.categories);
      if (config.maxEvalsPerRun) setMaxEvalsPerRun(config.maxEvalsPerRun);
      if (config.customPrompt) setCustomPrompt(config.customPrompt);
      setScheduleDraft((prev) => ({
        ...prev,
        enabled: config.enabled,
        cronExpr: config.cronExpr,
        timezone: config.timezone,
      }));
    });
    return () => reset();
  }, [agentId, fetchLatestRun, fetchRuns, fetchConfig, fetchKnowledgeProfile, reset]);

  // Cleanup toast on unmount
  useEffect(() => {
    return () => { toast.dismiss(TOAST_ID); };
  }, []);

  // Toast updates for streaming + intelligence building
  useEffect(() => {
    // Started running
    if (isRunning && !previousRunningRef.current) {
      toast.loading("Generating eval cases", {
        id: TOAST_ID,
        description: "Starting multi-step eval pipeline...",
      });
    }

    // Checkpoint during running
    if (isRunning && currentCheckpoint) {
      const key = `${currentCheckpoint.stage}:${currentCheckpoint.detail}`;
      if (key !== lastCheckpointRef.current) {
        toast.loading(currentCheckpoint.stage, {
          id: TOAST_ID,
          description: currentCheckpoint.detail,
        });
        lastCheckpointRef.current = key;
      }
    }

    // Intelligence building started (stream ended with intelligence_building status)
    if (isIntelligenceBuilding && !previousIntelligenceBuildingRef.current) {
      toast.info("Intelligence gathering in progress", {
        id: TOAST_ID,
        description: "Building domain knowledge in background. You'll receive an email when ready.",
        duration: 10000,
      });
    }

    // Stopped running (generation finished)
    if (!isRunning && previousRunningRef.current) {
      if (currentRun?.status === "completed") {
        toast.success("Eval generation complete", {
          id: TOAST_ID,
          description: `${currentRun.evalCount} eval cases generated`,
          duration: 4200,
        });
      } else if (currentRun?.status === "failed") {
        toast.error("Eval generation failed", {
          id: TOAST_ID,
          description: currentRun?.error || "Please retry.",
          duration: 4200,
        });
      } else if (!isIntelligenceBuilding) {
        toast.dismiss(TOAST_ID);
      }
      lastCheckpointRef.current = null;
    }

    previousRunningRef.current = isRunning;
    previousIntelligenceBuildingRef.current = isIntelligenceBuilding;
  }, [isRunning, isIntelligenceBuilding, currentCheckpoint, currentRun]);

  // Error toasts
  useEffect(() => {
    if (!error) { lastErrorRef.current = null; return; }
    if (lastErrorRef.current === error) return;
    toast.error(error, { id: "agent-evals-error", duration: 4500 });
    lastErrorRef.current = error;
  }, [error]);

  const handleRun = useCallback(async () => {
    await generateEvals(agentId, {
      categories: selectedCategories,
      maxEvalsPerRun,
      customPrompt: customPrompt.trim() || undefined,
      judgeModel: judgeModel.trim() || undefined,
    });
    await fetchRuns(agentId, 1, 20);
  }, [agentId, customPrompt, fetchRuns, generateEvals, judgeModel, maxEvalsPerRun, selectedCategories]);

  const saveRemoteConfig = useCallback(async () => {
    const result = await saveConfig(agentId, {
      enabled: scheduleDraft.enabled,
      cronExpr: scheduleDraft.cronExpr,
      timezone: scheduleDraft.timezone,
      categories: selectedCategories,
      maxEvalsPerRun,
      customPrompt: customPrompt.trim() || undefined,
    });
    if (result) toast.success("Eval config saved");
  }, [agentId, customPrompt, maxEvalsPerRun, saveConfig, scheduleDraft, selectedCategories]);

  const handleSelectRun = useCallback(
    (runId: string) => { fetchRunById(agentId, runId); },
    [agentId, fetchRunById]
  );

  const handleHistoryOpen = useCallback(() => {
    fetchRuns(agentId, pagination.page || 1, pagination.count || 20);
  }, [agentId, fetchRuns, pagination.count, pagination.page]);

  const handleHistoryPageChange = useCallback(
    (page: number) => { fetchRuns(agentId, page, pagination.count || 20); },
    [agentId, fetchRuns, pagination.count]
  );

  const handleExportJson = useCallback(() => {
    toast.loading("Exporting JSON...", { id: "eval-export" });
    exportJson(agentId, currentRun?.id).then(() => {
      toast.success("JSON exported", { id: "eval-export", duration: 3000 });
    });
  }, [agentId, currentRun?.id, exportJson]);

  const handleExportPromptfoo = useCallback(() => {
    toast.loading("Exporting Promptfoo YAML...", { id: "eval-export" });
    exportPromptfoo(agentId, currentRun?.id).then(() => {
      toast.success("Promptfoo YAML exported", { id: "eval-export", duration: 3000 });
    });
  }, [agentId, currentRun?.id, exportPromptfoo]);

  const handleRebuildKnowledge = useCallback(() => {
    toast.loading("Rebuilding knowledge profile...", { id: "knowledge-rebuild" });
    rebuildKnowledge(agentId).then(() => {
      toast.success("Knowledge profile rebuilt", { id: "knowledge-rebuild", duration: 3000 });
    });
  }, [agentId, rebuildKnowledge]);

  const showEmptyState = !isLoading && !currentRun && !isRunning && !isIntelligenceBuilding;
  const showStreamingSkeleton = isRunning && !currentRun;

  const historyAction = useMemo(
    () => (
      <EvalsHistorySheet
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
    [currentRun?.id, handleHistoryOpen, handleHistoryPageChange, handleSelectRun, isHistoryLoading, isRunning, pagination, runs]
  );

  return (
    <div className="space-y-5">
      <EvalsRunControls
        selectedCategories={selectedCategories}
        maxEvalsPerRun={maxEvalsPerRun}
        customPrompt={customPrompt}
        judgeModel={judgeModel}
        scheduleDraft={scheduleDraft}
        onCategoriesChange={setSelectedCategories}
        onMaxEvalsChange={setMaxEvalsPerRun}
        onCustomPromptChange={setCustomPrompt}
        onJudgeModelChange={setJudgeModel}
        onScheduleDraftChange={setScheduleDraft}
        onSaveRemoteConfig={saveRemoteConfig}
        onRun={handleRun}
        onExportJson={handleExportJson}
        onExportPromptfoo={handleExportPromptfoo}
        isRunning={isRunning}
        isIntelligenceBuilding={isIntelligenceBuilding}
        isConfigSaving={isConfigSaving}
        isExporting={isExporting}
        hasPersistedConfig={Boolean(configRecord)}
        hasRun={Boolean(currentRun)}
        historyAction={historyAction}
      />

      {/* Sub-tabs for Evals vs Knowledge */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as "evals" | "knowledge")}>
        <TabsList className="w-full max-w-xs">
          <TabsTrigger value="evals">
            <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
            Eval Cases
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <Brain className="mr-1.5 h-3.5 w-3.5" />
            Knowledge Base
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evals" className="mt-4">
          {/* Intelligence building banner */}
          {isIntelligenceBuilding && (
            <Card className="border-primary/30 bg-primary/5 px-5 py-4 mb-4">
              <div className="flex items-center gap-3">
                <Spinner className="h-5 w-5 border-2 border-primary/30 border-t-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Intelligence gathering in progress</p>
                  <p className="text-xs text-muted-foreground">
                    {currentCheckpoint?.detail || "Building domain knowledge from web, social, and code sources. You'll receive an email when ready."}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {currentRun ? <EvalsResults run={currentRun} /> : null}

          {showStreamingSkeleton ? (
            <Card className="border-border/60 bg-card px-5 py-8 text-center">
              <Spinner className="mx-auto h-7 w-7 border-2 border-border border-t-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {currentCheckpoint?.detail || "Running multi-step eval generation pipeline..."}
              </p>
            </Card>
          ) : null}

          {showEmptyState ? (
            <section className="rounded-sm border border-dashed border-border/70 bg-surface-2/20 px-6 py-10 text-center">
              <FlaskConical className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-lg font-semibold text-foreground">No evals generated yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click &quot;Generate Evals&quot; to create comprehensive test cases for this agent.
                You can also paste a PRD or feature requirements.
              </p>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="knowledge" className="mt-4">
          <KnowledgeProfileView
            profile={knowledgeProfile}
            isLoading={isKnowledgeLoading}
            onRebuild={handleRebuildKnowledge}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
