"use client";

import { CalendarClock, Download, Play, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  EVAL_ALL_CATEGORIES,
  EVAL_CATEGORY_DESCRIPTIONS,
  EVAL_CATEGORY_LABELS,
  EVAL_MAX_EVALS_OPTIONS,
  EVAL_SCHEDULE_PRESETS,
  type EvalCategory,
  type EvalSchedulePreset,
} from "@/constants/agent-evals";
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

export interface EvalScheduleDraft {
  enabled: boolean;
  preset: EvalSchedulePreset;
  cronExpr: string;
  timezone: string;
}

interface EvalsRunControlsProps {
  selectedCategories: EvalCategory[];
  maxEvalsPerRun: number;
  customPrompt: string;
  judgeModel: string;
  scheduleDraft: EvalScheduleDraft;
  onCategoriesChange: (categories: EvalCategory[]) => void;
  onMaxEvalsChange: (count: number) => void;
  onCustomPromptChange: (prompt: string) => void;
  onJudgeModelChange: (model: string) => void;
  onScheduleDraftChange: (next: EvalScheduleDraft) => void;
  onSaveRemoteConfig: () => void;
  onRun: () => void;
  onExportJson: () => void;
  onExportPromptfoo: () => void;
  isRunning: boolean;
  isIntelligenceBuilding: boolean;
  isConfigSaving?: boolean;
  isExporting?: boolean;
  hasPersistedConfig?: boolean;
  hasRun?: boolean;
  historyAction?: ReactNode;
}

export function EvalsRunControls({
  selectedCategories,
  maxEvalsPerRun,
  customPrompt,
  judgeModel,
  scheduleDraft,
  onCategoriesChange,
  onMaxEvalsChange,
  onCustomPromptChange,
  onJudgeModelChange,
  onScheduleDraftChange,
  onSaveRemoteConfig,
  onRun,
  onExportJson,
  onExportPromptfoo,
  isRunning,
  isIntelligenceBuilding,
  isConfigSaving = false,
  isExporting = false,
  hasPersistedConfig = false,
  hasRun = false,
  historyAction,
}: EvalsRunControlsProps) {
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isCronDialogOpen, setIsCronDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const toggleCategory = (category: EvalCategory) => {
    if (selectedCategories.includes(category)) {
      if (selectedCategories.length === 1) {
        toast.error("At least one eval category must remain selected");
        return;
      }
      onCategoriesChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoriesChange([...selectedCategories, category]);
    }
  };

  const handleRun = () => {
    onRun();
    setIsRunDialogOpen(false);
  };

  const handlePresetChange = (next: EvalSchedulePreset) => {
    const preset = EVAL_SCHEDULE_PRESETS.find((p) => p.value === next);
    onScheduleDraftChange({
      ...scheduleDraft,
      preset: next,
      cronExpr: next === "custom" ? scheduleDraft.cronExpr : preset?.cron || scheduleDraft.cronExpr,
    });
  };

  const saveCron = () => {
    onSaveRemoteConfig();
    setIsCronDialogOpen(false);
  };

  return (
    <section className="rounded-sm border border-border/60 bg-surface-2/20 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Automated Evals
          </p>
          <p className="text-lg font-semibold text-foreground">
            Generate comprehensive evaluation test cases for this agent.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-sm border border-border/60 bg-background/80 px-2 py-1">
              Categories: <span className="font-medium text-foreground">{selectedCategories.length}</span>
            </span>
            <span className="rounded-sm border border-border/60 bg-background/80 px-2 py-1">
              Max evals: <span className="font-medium text-foreground">{maxEvalsPerRun}</span>
            </span>
            <span className="rounded-sm border border-border/60 bg-background/80 px-2 py-1">
              Cron: <span className="font-medium text-foreground">{scheduleDraft.enabled ? "Enabled" : "Disabled"}</span>
            </span>
            {isIntelligenceBuilding && (
              <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                Intelligence building...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          {historyAction}

          {hasRun && (
            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-10 gap-2 px-4">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md border-border/60 bg-card">
                <DialogHeader>
                  <DialogTitle>Export Evals</DialogTitle>
                  <DialogDescription>Download eval cases in your preferred format.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3"
                    onClick={() => { onExportJson(); setIsExportDialogOpen(false); }}
                    loading={isExporting}
                  >
                    <Download className="h-4 w-4" />
                    Export as JSON
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3"
                    onClick={() => { onExportPromptfoo(); setIsExportDialogOpen(false); }}
                    loading={isExporting}
                  >
                    <Download className="h-4 w-4" />
                    Export as Promptfoo YAML
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isCronDialogOpen} onOpenChange={setIsCronDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-10 gap-2 px-4">
                <CalendarClock className="h-4 w-4" />
                Cron Setup
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-border/60 bg-card p-0">
              <DialogHeader className="border-b border-border/55 px-5 py-4">
                <DialogTitle className="text-lg">Eval Cron Setup</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Schedule recurring eval generation for this agent.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <section className="space-y-3 rounded-sm border border-border/60 bg-surface-2/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Schedule State</p>
                      <p className="mt-1 text-sm text-muted-foreground">Enable or disable scheduled eval generation.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={scheduleDraft.enabled ? "primary" : "outline"}
                      onClick={() => onScheduleDraftChange({ ...scheduleDraft, enabled: !scheduleDraft.enabled })}
                    >
                      {scheduleDraft.enabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Preset</Label>
                      <Select value={scheduleDraft.preset} onValueChange={(v) => handlePresetChange(v as EvalSchedulePreset)}>
                        <SelectTrigger><SelectValue placeholder="Select preset" /></SelectTrigger>
                        <SelectContent>
                          {EVAL_SCHEDULE_PRESETS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Timezone</Label>
                      <Input
                        value={scheduleDraft.timezone}
                        onChange={(e) => onScheduleDraftChange({ ...scheduleDraft, timezone: e.target.value })}
                        placeholder="UTC"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Cron Expression</Label>
                      <Input
                        value={scheduleDraft.cronExpr}
                        onChange={(e) => onScheduleDraftChange({ ...scheduleDraft, cronExpr: e.target.value, preset: "custom" })}
                        placeholder="0 2 * * 1"
                      />
                    </div>
                  </div>
                </section>
              </div>
              <DialogFooter className="border-t border-border/55 bg-surface-2/25 px-5 py-4">
                <Button size="sm" variant="outline" onClick={() => setIsCronDialogOpen(false)}>Cancel</Button>
                <Button size="sm" variant="primary" onClick={saveCron} loading={isConfigSaving}>
                  {hasPersistedConfig ? "Update Config" : "Save Config"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="primary" disabled={isRunning || isIntelligenceBuilding} className="h-10 gap-2 px-4">
                <Sparkles className="h-4 w-4" />
                Generate Evals
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border-border/60 bg-card p-0">
              <DialogHeader className="border-b border-border/55 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Generate Evaluation Cases
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Configure categories, count, and optional PRD/feature prompt.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Eval Categories</Label>
                    <span className="text-xs text-muted-foreground">{selectedCategories.length} / {EVAL_ALL_CATEGORIES.length} selected</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {EVAL_ALL_CATEGORIES.map((cat) => {
                      const selected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={cn(
                            "rounded-sm border px-3 py-2 text-left transition-colors",
                            selected ? "border-primary/40 bg-primary/10" : "border-border/60 bg-surface-2/20 hover:bg-surface-2/35"
                          )}
                        >
                          <p className="text-sm font-medium text-foreground">{EVAL_CATEGORY_LABELS[cat]}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{EVAL_CATEGORY_DESCRIPTIONS[cat]}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-2.5">
                  <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Max Evals Per Run</Label>
                  <Select value={String(maxEvalsPerRun)} onValueChange={(v) => onMaxEvalsChange(Number(v))}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Select count" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVAL_MAX_EVALS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>

                <section className="space-y-2.5">
                  <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    PRD / Feature Prompt (optional)
                  </Label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => onCustomPromptChange(e.target.value)}
                    placeholder="Paste your PRD, feature requirements, or describe what you want to test..."
                    className="w-full rounded-sm border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[120px] resize-y"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will generate &quot;feature_specific&quot; eval cases targeting these exact requirements.
                  </p>
                </section>

                <section className="space-y-2.5">
                  <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Judge Model Override</Label>
                  <Input
                    value={judgeModel}
                    onChange={(e) => onJudgeModelChange(e.target.value)}
                    placeholder="default (server configured)"
                    className="w-full sm:w-96"
                  />
                </section>
              </div>

              <DialogFooter className="border-t border-border/55 bg-surface-2/25 px-5 py-4">
                <Button size="sm" variant="outline" onClick={() => setIsRunDialogOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleRun}
                  disabled={isRunning || selectedCategories.length === 0}
                  loading={isRunning}
                  className="h-9 gap-2 px-4"
                >
                  <Play className="h-3.5 w-3.5" />
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}
