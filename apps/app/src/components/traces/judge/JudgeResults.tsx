import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  JudgeDimension,
  JudgeResult,
} from "@/stores/judgeStore";
import { DIMENSION_LABELS, ALL_DIMENSIONS as DIMENSIONS } from "@/stores/judgeStore";
import {
  ScoreBar,
  ScoreCircle,
  SeverityBadge,
} from "../judge-score";
import { FindingsWorkbench } from "./FindingsWorkbench";
import { STREAMING_STATUS_LABELS } from "./constants";

interface JudgeResultsProps {
  result: JudgeResult;
  systemPrompt: string;
  tools?: unknown[];
  isStreaming?: boolean;
}

export function JudgeResults({
  result,
  systemPrompt,
  tools,
  isStreaming = false,
}: JudgeResultsProps) {
  const summary = result.summary ?? {};
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const normalizedStatus = (result.status || "running").toLowerCase();
  const statusLabel = STREAMING_STATUS_LABELS[normalizedStatus] || result.status;
  const isFailed = result.status === "failed";
  const isRunning = isStreaming || normalizedStatus === "running" || normalizedStatus === "queued";
  const overallScore = typeof summary.overallScore === "number" ? summary.overallScore : -1;
  const totalIssues = typeof summary.totalIssues === "number" ? summary.totalIssues : 0;
  const totalPatches = typeof summary.totalPatches === "number" ? summary.totalPatches : 0;
  const bySeverity = summary.bySeverity ?? {};
  const rawDimensionDetails = Array.isArray(summary.dimensionDetails) ? summary.dimensionDetails : [];

  const severityEntries = Object.entries(bySeverity).filter(
    ([severity, count]) =>
      (severity === "low" || severity === "medium" || severity === "high" || severity === "critical") &&
      Number(count) > 0
  ) as Array<
    ["low" | "medium" | "high" | "critical", number]
  >;

  const dimensionDetails: DimensionScoreDetail[] = rawDimensionDetails
    .map((detail): DimensionScoreDetail | null => {
      const dimension = detail?.dimension as JudgeDimension | undefined;
      if (!dimension || !(dimension in DIMENSION_LABELS)) {
        return null;
      }

      return {
        dimension,
        score: typeof detail.score === "number" ? detail.score : -1,
        issueCount: typeof detail.issueCount === "number" ? detail.issueCount : 0,
        patchCount: typeof detail.patchCount === "number" ? detail.patchCount : 0,
        skipped: Boolean(detail.skipped),
        pending: false,
        skipReason: typeof detail.skipReason === "string" ? detail.skipReason : undefined,
      };
    })
    .filter((detail): detail is DimensionScoreDetail => detail !== null);

  const detailByDimension = new Map(dimensionDetails.map((detail) => [detail.dimension, detail] as const));

  const stableDimensionDetails: DimensionScoreDetail[] = DIMENSIONS.map((dimension) => {
    const existing = detailByDimension.get(dimension);
    if (existing) {
      return existing;
    }

    if (isRunning) {
      return {
        dimension,
        score: -1,
        issueCount: 0,
        patchCount: 0,
        skipped: false,
        pending: true,
      };
    }

    return {
      dimension,
      score: -1,
      issueCount: 0,
      patchCount: 0,
      skipped: true,
      pending: false,
      skipReason: "No data returned for this dimension.",
    };
  });

  return (
    <div className="space-y-5">
      <section className="rounded-sm border border-border/60 bg-card px-5 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <ScoreCircle score={overallScore} size="lg" label="Overall" className="shrink-0" />

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-semibold text-foreground">
                {isRunning ? "Analysis in progress" : isFailed ? "Analysis failed" : "Analysis complete"}
              </span>
              <Badge
                className={cn(
                  "h-5 px-1.5 text-[10px] font-medium capitalize",
                  isRunning
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/70 bg-surface-2 text-muted-foreground"
                )}
              >
                {statusLabel}
              </Badge>
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <MetaField label="Model" value={result.judgeModel || "Unknown"} />
              <MetaField label="Mode" value={result.mode || "unknown"} capitalize />
              <MetaField label="Issues" value={String(totalIssues)} />
              <MetaField label="Patches" value={String(totalPatches)} />
            </div>

            {severityEntries.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {severityEntries.map(([severity, count]) => (
                  <div
                    key={severity}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-border/55 bg-surface-2/40 px-2 py-1"
                  >
                    <SeverityBadge severity={severity} />
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stableDimensionDetails.map((detail) => (
          <DimensionScoreCard key={detail.dimension} detail={detail} />
        ))}
      </div>

      {findings.length > 0 ? (
        <FindingsWorkbench
          findings={findings}
          systemPrompt={systemPrompt}
          tools={tools}
          isStreaming={isRunning}
        />
      ) : (
        <section className="flex items-center gap-2 rounded-sm border border-border/60 bg-surface-2/20 px-4 py-5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          {isRunning
            ? "Waiting for structured findings. Score checkpoints are streaming and this section updates in place."
            : "No findings were reported for this analysis."}
        </section>
      )}
    </div>
  );
}

interface MetaFieldProps {
  label: string;
  value: string;
  capitalize?: boolean;
}

function MetaField({ label, value, capitalize = false }: MetaFieldProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-sm border border-border/55 bg-surface-2/30 px-2.5 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("truncate font-medium text-foreground", capitalize && "capitalize")}>{value}</span>
    </div>
  );
}

interface DimensionScoreCardProps {
  detail: DimensionScoreDetail;
}

interface DimensionScoreDetail {
  dimension: JudgeDimension;
  score: number;
  issueCount: number;
  patchCount: number;
  skipped: boolean;
  pending: boolean;
  skipReason?: string;
}

function DimensionScoreCard({ detail }: DimensionScoreCardProps) {
  const label = DIMENSION_LABELS[detail.dimension] || detail.dimension;

  if (detail.pending) {
    return (
      <section className="space-y-3 rounded-sm border border-border/55 bg-background/80 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <Badge className="h-5 border-primary/30 bg-primary/10 px-1.5 text-[10px] text-primary">
            Streaming
          </Badge>
        </div>
        <div className="h-1.5 rounded-sm bg-surface-3" />
        <div className="h-4 w-40 rounded-sm bg-surface-2/70" />
      </section>
    );
  }

  if (detail.skipped) {
    return (
      <section className="space-y-2 rounded-sm border border-border/55 bg-surface-2/35 px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <Badge className="h-5 border-border/70 bg-surface-2/60 px-1.5 text-[10px] text-muted-foreground">
            Skipped
          </Badge>
        </div>

        {detail.skipReason ? <p className="text-sm text-muted-foreground">{detail.skipReason}</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-sm border border-border/55 bg-background/80 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <ScoreCircle score={detail.score} size="sm" />
      </div>

      <ScoreBar score={detail.score} />

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {detail.issueCount} issue{detail.issueCount === 1 ? "" : "s"}
        </span>

        <span className="inline-flex items-center gap-1">
          <Wrench className="h-3.5 w-3.5" />
          {detail.patchCount} patch{detail.patchCount === 1 ? "" : "es"}
        </span>
      </div>
    </section>
  );
}
