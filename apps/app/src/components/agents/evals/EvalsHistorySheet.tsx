"use client";

import { Clock, History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Pagination } from "@/types/global";
import type { EvalRun } from "@/stores/agentEvalsStore";

interface EvalsHistorySheetProps {
  runs: EvalRun[];
  currentRunId: string | undefined;
  isLoading: boolean;
  isRunning: boolean;
  pagination: Pagination;
  onSelect: (runId: string) => void;
  onOpen: () => void;
  onPageChange: (page: number) => void;
}

const STATUS_VARIANTS: Record<string, string> = {
  completed: "border-primary/25 bg-primary/10 text-primary",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
  running: "border-border/60 bg-surface-2/40 text-foreground",
  pending: "border-warning/25 bg-warning/10 text-warning",
};

export function EvalsHistorySheet({
  runs,
  currentRunId,
  isLoading,
  isRunning,
  pagination,
  onSelect,
  onOpen,
  onPageChange,
}: EvalsHistorySheetProps) {
  return (
    <Sheet onOpenChange={(open) => open && onOpen()}>
      <SheetTrigger asChild>
        <Button size="sm" className="h-10 gap-2 px-4">
          <History className="h-4 w-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto border-border/60 bg-card">
        <SheetHeader className="border-b border-border/55 pb-4">
          <SheetTitle>Eval Generation History</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-6 w-6 border-2 text-primary" />
          </div>
        ) : runs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No eval runs yet.</p>
        ) : (
          <div className="space-y-2 py-4">
            {runs.map((run) => {
              const isActive = run.id === currentRunId;
              const date = new Date(run.createdAt);

              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => onSelect(run.id)}
                  disabled={isRunning}
                  className={cn(
                    "w-full rounded-sm border px-3 py-3 text-left transition-colors",
                    isActive
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 hover:bg-surface-2/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={cn("px-1.5 py-0 text-[10px] capitalize", STATUS_VARIANTS[run.status])}>
                      {run.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{run.evalCount} evals</span>
                    <span>{run.trigger}</span>
                    {run.summary?.domain && <span>{run.summary.domain}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-border/55 pt-4">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasMore}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
