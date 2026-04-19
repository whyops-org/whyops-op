import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JudgeFinding } from "@/stores/judgeStore";
import { DimensionBadge, SeverityBadge } from "../judge-score";
import { formatScore, getScoreClass } from "./utils";

interface FindingListItemProps {
  finding: JudgeFinding;
  isActive: boolean;
  onClick: () => void;
}

export function FindingListItem({ finding, isActive, onClick }: FindingListItemProps) {
  const firstIssue = finding.evidence?.issues?.[0]?.detail;
  const preview = firstIssue || finding.recommendation?.detail || "No details provided";
  const score = finding.evidence?.score ?? -1;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-sm border p-3.5 text-left transition-colors",
        isActive
          ? "border-primary/45 bg-primary/10"
          : "border-border/60 bg-background/80 hover:border-border hover:bg-surface-2/45"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <DimensionBadge dimension={finding.dimension} />
        <SeverityBadge severity={finding.severity} />
        {finding.stepId != null ? (
          <Badge className="h-5 px-1.5 text-[10px]">Step {finding.stepId}</Badge>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground/95">{preview}</p>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          Score: <span className={cn("font-semibold", getScoreClass(score))}>{formatScore(score)}</span>
        </span>
        <span className="tabular-nums">Conf: {Math.round(finding.confidence * 100)}%</span>
      </div>
    </button>
  );
}
