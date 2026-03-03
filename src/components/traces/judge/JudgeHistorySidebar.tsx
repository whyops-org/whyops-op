import { Clock3, History } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PastAnalysis } from "@/stores/judgeStore";
import { formatRelativeTime, getScoreClass } from "./utils";

interface JudgeHistorySidebarProps {
  analyses: PastAnalysis[];
  currentId?: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
  isRunning?: boolean;
}

export function JudgeHistorySidebar({
  analyses,
  currentId,
  onSelect,
  isLoading,
  isRunning = false,
}: JudgeHistorySidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sortedAnalyses = useMemo(() => {
    return [...analyses].sort((a, b) => {
      const aTime = new Date(a.finishedAt || a.createdAt).getTime();
      const bTime = new Date(b.finishedAt || b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [analyses]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-10 w-10 p-0"
          aria-label="Open analysis history"
        >
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex h-full w-[95vw] flex-col sm:w-[34rem] sm:max-w-[34rem]"
      >
        <SheetHeader>
          <div className="flex items-center justify-between gap-2 pr-10">
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Analysis History
            </SheetTitle>
            <Badge className="text-[10px]">{sortedAnalyses.length} runs</Badge>
          </div>
          <SheetDescription>
            Select a previous analysis run to load its full findings.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {isRunning ? (
            <div className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
              Running analysis in progress. History selection is temporarily disabled.
            </div>
          ) : null}

          {sortedAnalyses.length === 0 ? (
            <div className="flex min-h-[10rem] items-center justify-center rounded-sm border border-dashed border-border/70 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
              No past analyses yet.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAnalyses.map((analysis) => {
                const isActive = analysis.id === currentId;
                const overallScore = analysis.summary?.overallScore;
                const completedAt = analysis.finishedAt || analysis.createdAt;
                const canSelect = !isLoading && !isRunning;

                return (
                  <button
                    key={analysis.id}
                    type="button"
                    onClick={() => {
                      onSelect(analysis.id);
                      setIsOpen(false);
                    }}
                    disabled={!canSelect}
                    className={cn(
                      "grid w-full gap-3 rounded-sm border px-3 py-3 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center",
                      isActive
                        ? "border-primary/45 bg-primary/10"
                        : "border-border/60 bg-background/80 hover:border-border hover:bg-surface-2/45",
                      !canSelect && "cursor-not-allowed opacity-70"
                    )}
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {analysis.id.substring(0, 8)}
                        </span>
                        {isActive ? (
                          <Badge className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                            Current
                          </Badge>
                        ) : null}
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          {formatRelativeTime(completedAt)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="text-[10px] capitalize">{analysis.mode}</Badge>
                        <Badge className="text-[10px]">{analysis.rubricVersion}</Badge>
                        {analysis.judgeModel ? (
                          <span className="truncate text-xs text-muted-foreground">{analysis.judgeModel}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="text-sm font-medium capitalize text-foreground">{analysis.status}</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Score</p>
                      {overallScore != null && overallScore >= 0 ? (
                        <p className={cn("text-2xl font-semibold tabular-nums", getScoreClass(overallScore))}>
                          {Math.round(overallScore * 100)}
                        </p>
                      ) : (
                        <p className="text-2xl font-semibold text-muted-foreground">N/A</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
