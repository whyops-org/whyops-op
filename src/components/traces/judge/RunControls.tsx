import { Play, Scale, Settings2, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";

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
import { cn } from "@/lib/utils";
import {
  ALL_DIMENSIONS,
  DIMENSION_LABELS,
  type JudgeDimension,
} from "@/stores/judgeStore";
import { MODE_LABELS } from "./constants";
import type { JudgeMode } from "./types";

interface RunControlsProps {
  selectedDimensions: JudgeDimension[];
  mode: JudgeMode;
  onModeChange: (mode: JudgeMode) => void;
  onToggleDimension: (dimension: JudgeDimension) => void;
  onRun: () => void;
  isRunning: boolean;
  historyAction?: ReactNode;
}

export function RunControls({
  selectedDimensions,
  mode,
  onModeChange,
  onToggleDimension,
  onRun,
  isRunning,
  historyAction,
}: RunControlsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleRun = () => {
    onRun();
    setIsDialogOpen(false);
  };

  return (
    <section className="rounded-sm border border-border/60 bg-surface-2/20 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            LLM Judge
          </p>
          <p className="text-lg font-semibold text-foreground">
            Evaluate trace quality and apply prompt-safe fixes.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-sm border border-border/60 bg-background/80 px-2 py-1">
              Mode: <span className="font-medium capitalize text-foreground">{mode}</span>
            </span>
            <span className="rounded-sm border border-border/60 bg-background/80 px-2 py-1">
              Dimensions: <span className="font-medium text-foreground">{selectedDimensions.length}</span> /{" "}
              {ALL_DIMENSIONS.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          {historyAction}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="primary"
                disabled={isRunning}
                className="h-10 gap-2 self-start px-4"
              >
                <Settings2 className="h-4 w-4" />
                Configure & Run
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] max-w-3xl border-border/60 bg-card p-0">
              <DialogHeader className="border-b border-border/55 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Run LLM Judge
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Choose depth and dimensions, then run analysis. Results stream directly into the panel.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <section className="space-y-2.5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Analysis Mode
                  </p>
                  <div className="inline-flex items-center rounded-sm border border-border/70 bg-surface-2/50 p-0.5">
                    {(Object.keys(MODE_LABELS) as JudgeMode[]).map((modeOption) => {
                      const isActive = modeOption === mode;
                      return (
                        <button
                          key={modeOption}
                          type="button"
                          onClick={() => onModeChange(modeOption)}
                          className={cn(
                            "h-9 rounded-sm px-4 text-sm font-semibold uppercase tracking-wide transition-colors",
                            isActive
                              ? "bg-card text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {MODE_LABELS[modeOption]}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-2.5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Evaluation Dimensions
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ALL_DIMENSIONS.map((dimension) => {
                      const isSelected = selectedDimensions.includes(dimension);
                      return (
                        <button
                          key={dimension}
                          type="button"
                          onClick={() => onToggleDimension(dimension)}
                          className={cn(
                            "inline-flex h-10 items-center gap-2 rounded-sm border px-3 text-sm font-medium transition-colors",
                            isSelected
                              ? "border-primary/45 bg-primary/10 text-foreground"
                              : "border-border/60 bg-surface-2/30 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              isSelected ? "bg-primary" : "bg-border"
                            )}
                          />
                          {DIMENSION_LABELS[dimension]}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <DialogFooter className="border-t border-border/55 bg-surface-2/25 px-5 py-4">
                <p className="mr-auto text-sm text-muted-foreground">
                  {selectedDimensions.length} of {ALL_DIMENSIONS.length} dimensions selected
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="h-9 px-4"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleRun}
                  disabled={isRunning || selectedDimensions.length === 0}
                  loading={isRunning}
                  className="h-9 gap-2 px-4"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Judge
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}
