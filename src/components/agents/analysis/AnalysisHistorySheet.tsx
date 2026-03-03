"use client";

import { Clock3, History, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AgentAnalysisRun } from "@/stores/agentAnalysisStore";
import type { Pagination } from "@/types/global";
import { formatRelativeTime } from "./utils";

interface AnalysisHistorySheetProps {
  runs: AgentAnalysisRun[];
  currentRunId?: string;
  isLoading: boolean;
  isRunning: boolean;
  pagination: Pagination;
  onSelect: (runId: string) => void;
  onOpen: () => void;
  onPageChange: (page: number) => void;
}

function statusClass(status: AgentAnalysisRun["status"]): string {
  if (status === "completed") return "text-primary";
  if (status === "failed") return "text-destructive";
  return "text-warning";
}

export function AnalysisHistorySheet({
  runs,
  currentRunId,
  isLoading,
  isRunning,
  pagination,
  onSelect,
  onOpen,
  onPageChange,
}: AnalysisHistorySheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setIsOpen(next);
    if (next) onOpen();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-2">
          <History className="h-4 w-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-border/50">
          <SheetTitle>Agent Analysis History</SheetTitle>
          <SheetDescription>
            Browse previous runs and load detailed section outputs.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <div className="rounded-sm border border-border/60 bg-surface-2/20 p-4 text-sm text-muted-foreground">
              Loading analysis runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border/70 bg-surface-2/20 p-4 text-sm text-muted-foreground">
              No runs available yet.
            </div>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelect(run.id)}
                className={`w-full rounded-sm border px-3 py-3 text-left transition-colors ${
                  currentRunId === run.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/60 bg-background hover:bg-surface-2/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    Run {run.id.slice(0, 8)}
                  </p>
                  <span className={`text-xs font-semibold uppercase ${statusClass(run.status)}`}>
                    {run.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatRelativeTime(run.createdAt)}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {run.traceCount} traces • {run.eventCount} events
                </p>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages || 1}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={pagination.page <= 1 || isLoading}
                onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={!pagination.hasMore || isLoading}
                onClick={() => onPageChange(pagination.page + 1)}
              >
                Next
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={onOpen}
                disabled={isLoading || isRunning}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
