"use client";

import { CalendarClock, Play, Settings2, Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AGENT_ANALYSIS_ALL_DIMENSIONS,
  AGENT_ANALYSIS_DIMENSION_DESCRIPTIONS,
  AGENT_ANALYSIS_DIMENSION_LABELS,
  AGENT_ANALYSIS_LOOKBACK_OPTIONS,
  AGENT_ANALYSIS_MODE_LABELS,
  AGENT_ANALYSIS_SCHEDULE_PRESETS,
  type AgentAnalysisDimension,
  type AgentAnalysisMode,
  type AgentAnalysisSchedulePreset,
} from "@/constants/agent-analysis";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface AgentAnalysisScheduleDraft {
  enabled: boolean;
  preset: AgentAnalysisSchedulePreset;
  cronExpr: string;
  timezone: string;
  judgeModel: string;
  dimensions: AgentAnalysisDimension[];
}

interface AnalysisRunControlsProps {
  mode: AgentAnalysisMode;
  lookbackDays: number;
  judgeModel: string;
  selectedDimensions: AgentAnalysisDimension[];
  scheduleDraft: AgentAnalysisScheduleDraft;
  onModeChange: (mode: AgentAnalysisMode) => void;
  onLookbackDaysChange: (days: number) => void;
  onJudgeModelChange: (model: string) => void;
  onSelectedDimensionsChange: (dimensions: AgentAnalysisDimension[]) => void;
  onScheduleDraftChange: (next: AgentAnalysisScheduleDraft) => void;
  onSaveScheduleDraft: () => void;
  onSaveRemoteConfig: () => void;
  onRun: () => void;
  isRunning: boolean;
  isConfigSaving?: boolean;
  hasPersistedConfig?: boolean;
  historyAction?: ReactNode;
}

export function AnalysisRunControls({
  mode,
  lookbackDays,
  judgeModel,
  selectedDimensions,
  scheduleDraft,
  onModeChange,
  onLookbackDaysChange,
  onJudgeModelChange,
  onSelectedDimensionsChange,
  onScheduleDraftChange,
  onSaveScheduleDraft,
  onSaveRemoteConfig,
  onRun,
  isRunning,
  isConfigSaving = false,
  hasPersistedConfig = false,
  historyAction,
}: AnalysisRunControlsProps) {
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isCronDialogOpen, setIsCronDialogOpen] = useState(false);

  const lookbackLabel = useMemo(
    () =>
      AGENT_ANALYSIS_LOOKBACK_OPTIONS.find((item) => item.value === lookbackDays)?.label ||
      `${lookbackDays} days`,
    [lookbackDays]
  );

  const handleRun = () => {
    onRun();
    setIsManualDialogOpen(false);
  };

  const handlePresetChange = (nextPreset: AgentAnalysisSchedulePreset) => {
    const preset = AGENT_ANALYSIS_SCHEDULE_PRESETS.find((item) => item.value === nextPreset);
    onScheduleDraftChange({
      ...scheduleDraft,
      preset: nextPreset,
      cronExpr: nextPreset === "custom" ? scheduleDraft.cronExpr : preset?.cron || scheduleDraft.cronExpr,
    });
  };

  const toggleDimension = (dimension: AgentAnalysisDimension) => {
    if (selectedDimensions.includes(dimension)) {
      if (selectedDimensions.length === 1) {
        toast.error("At least one analysis dimension must remain selected");
        return;
      }
      onSelectedDimensionsChange(selectedDimensions.filter((item) => item !== dimension));
      return;
    }
    onSelectedDimensionsChange([...selectedDimensions, dimension]);
  };

  const saveCron = () => {
    onSaveRemoteConfig();
    setIsCronDialogOpen(false);
  };

  return (
    <section className="rounded-sm border border-border/60 bg-surface-2/20 p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Agent Analysis
          </p>
          <p className="text-2xl font-semibold text-foreground">
            Analyze overall agent behavior from traces and judge signals.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-sm border border-border/60 bg-background/80 px-3 py-1.5">
              Mode: <span className="font-medium text-foreground">{AGENT_ANALYSIS_MODE_LABELS[mode]}</span>
            </span>
            <span className="rounded-sm border border-border/60 bg-background/80 px-3 py-1.5">
              Window: <span className="font-medium text-foreground">{lookbackLabel}</span>
            </span>
            <span className="rounded-sm border border-border/60 bg-background/80 px-3 py-1.5">
              Dimensions: <span className="font-medium text-foreground">{selectedDimensions.length}</span>
            </span>
            <span className="rounded-sm border border-border/60 bg-background/80 px-3 py-1.5">
              Cron: <span className="font-medium text-foreground">{scheduleDraft.enabled ? "Enabled" : "Disabled"}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          {historyAction}

          <Dialog open={isCronDialogOpen} onOpenChange={setIsCronDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-11 gap-2 px-4.5">
                <CalendarClock className="h-4 w-4" />
                Cron Setup
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-border/60 bg-card p-0">
              <DialogHeader className="border-b border-border/55 px-5 py-4">
                <DialogTitle className="text-lg">Cron Setup</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Configure recurring agent-analysis schedule and persist config.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <section className="space-y-4 rounded-sm border border-border/60 bg-surface-2/25 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Schedule state</p>
                      <p className="mt-1 text-base leading-relaxed text-muted-foreground">Enable or disable scheduled runs.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={scheduleDraft.enabled ? "primary" : "outline"}
                      onClick={() =>
                        onScheduleDraftChange({
                          ...scheduleDraft,
                          enabled: !scheduleDraft.enabled,
                        })
                      }
                    >
                      {scheduleDraft.enabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">Preset</Label>
                      <Select
                        value={scheduleDraft.preset}
                        onValueChange={(value) => handlePresetChange(value as AgentAnalysisSchedulePreset)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select preset" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGENT_ANALYSIS_SCHEDULE_PRESETS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">Timezone</Label>
                      <Input
                        value={scheduleDraft.timezone}
                        onChange={(event) =>
                          onScheduleDraftChange({
                            ...scheduleDraft,
                            timezone: event.target.value,
                          })
                        }
                        placeholder="UTC"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-sm text-muted-foreground">Cron Expression</Label>
                      <Input
                        value={scheduleDraft.cronExpr}
                        onChange={(event) =>
                          onScheduleDraftChange({
                            ...scheduleDraft,
                            cronExpr: event.target.value,
                            preset: "custom",
                          })
                        }
                        placeholder="0 9 * * *"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-sm border border-border/60 bg-surface-2/25 p-5">
                  <p className="text-sm font-medium text-muted-foreground">Current config</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">This cron config will use your current run settings:</p>
                  <div className="mt-3 rounded-sm border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                    <p>
                      Mode: <span className="font-medium text-foreground">{AGENT_ANALYSIS_MODE_LABELS[mode]}</span>
                    </p>
                    <p className="mt-1">
                      Lookback: <span className="font-medium text-foreground">{lookbackLabel}</span>
                    </p>
                    <p className="mt-1">
                      Judge model: <span className="font-medium text-foreground">{judgeModel || "default"}</span>
                    </p>
                    <p className="mt-1">
                      Dimensions: <span className="font-medium text-foreground">{selectedDimensions.length}</span>
                    </p>
                  </div>
                </section>
              </div>

              <DialogFooter className="border-t border-border/55 bg-surface-2/25 px-5 py-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onSaveScheduleDraft();
                    toast.success("Schedule draft saved locally");
                  }}
                >
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCronDialogOpen(false)}
                  className="h-10 px-4"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={saveCron}
                  loading={isConfigSaving}
                  disabled={isConfigSaving}
                >
                  {hasPersistedConfig ? "Update Config" : "Save Config"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="primary" disabled={isRunning} className="h-11 gap-2 px-4.5">
                <Settings2 className="h-4 w-4" />
                Manual Run
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border-border/60 bg-card p-0">
              <DialogHeader className="border-b border-border/55 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Manual Agent Analysis Run
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Configure mode, dimensions, and model override for this immediate run.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <section className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Analysis mode</p>
                  <div className="inline-flex items-center rounded-sm border border-border/70 bg-surface-2/50 p-0.5">
                    {(Object.keys(AGENT_ANALYSIS_MODE_LABELS) as AgentAnalysisMode[]).map((modeOption) => {
                      const isActive = modeOption === mode;
                      return (
                        <button
                          key={modeOption}
                          type="button"
                          onClick={() => onModeChange(modeOption)}
                          className={cn(
                            "h-10 rounded-sm px-4.5 text-sm font-medium transition-colors",
                            isActive ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {AGENT_ANALYSIS_MODE_LABELS[modeOption]}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Lookback window</Label>
                  <Select value={String(lookbackDays)} onValueChange={(value) => onLookbackDaysChange(Number(value))}>
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue placeholder="Select lookback window" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_ANALYSIS_LOOKBACK_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={String(item.value)}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>

                <section className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Judge model override</Label>
                  <Input
                    value={judgeModel}
                    onChange={(event) => onJudgeModelChange(event.target.value)}
                    placeholder="default (server configured)"
                    className="w-full sm:w-96"
                  />
                  <p className="text-sm leading-relaxed text-muted-foreground">Leave empty to use server default judge model.</p>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Deep analysis dimensions</Label>
                    <span className="text-sm text-muted-foreground">
                      {selectedDimensions.length} / {AGENT_ANALYSIS_ALL_DIMENSIONS.length} selected
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {AGENT_ANALYSIS_ALL_DIMENSIONS.map((dimension) => {
                      const selected = selectedDimensions.includes(dimension);
                      return (
                        <button
                          key={dimension}
                          type="button"
                          onClick={() => toggleDimension(dimension)}
                          className={cn(
                            "rounded-sm border px-4 py-3 text-left transition-colors",
                            selected
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/60 bg-surface-2/20 hover:bg-surface-2/35"
                          )}
                        >
                          <p className="text-base font-medium text-foreground">{AGENT_ANALYSIS_DIMENSION_LABELS[dimension]}</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{AGENT_ANALYSIS_DIMENSION_DESCRIPTIONS[dimension]}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <DialogFooter className="border-t border-border/55 bg-surface-2/25 px-5 py-4">
                <Button size="sm" variant="outline" onClick={() => setIsManualDialogOpen(false)} className="h-10 px-4">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleRun}
                  disabled={isRunning || selectedDimensions.length === 0}
                  loading={isRunning}
                  className="h-10 gap-2 px-4.5"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Analysis
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}
