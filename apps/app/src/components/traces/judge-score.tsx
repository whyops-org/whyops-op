"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScoreCircleProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

function getScoreTone(score: number): "good" | "medium" | "low" | "na" {
  if (!Number.isFinite(score) || score < 0) return "na";
  if (score >= 0.7) return "good";
  if (score >= 0.5) return "medium";
  return "low";
}

function getScoreTextClass(score: number): string {
  const tone = getScoreTone(score);
  if (tone === "good") return "text-primary";
  if (tone === "medium") return "text-warning";
  if (tone === "low") return "text-destructive";
  return "text-muted-foreground";
}

function getScoreRingClass(score: number): string {
  const tone = getScoreTone(score);
  if (tone === "good") return "stroke-primary";
  if (tone === "medium") return "stroke-warning";
  if (tone === "low") return "stroke-destructive";
  return "stroke-muted-foreground";
}

const SIZES = {
  sm: { outer: 50, stroke: 3, text: "text-sm", label: "text-[10px]" },
  md: { outer: 72, stroke: 4, text: "text-lg", label: "text-[11px]" },
  lg: { outer: 100, stroke: 5, text: "text-2xl", label: "text-xs" },
} as const;

export function ScoreCircle({ score, size = "md", label, className }: ScoreCircleProps) {
  const cfg = SIZES[size];
  const normalizedScore = Number.isFinite(score) && score >= 0 ? Math.max(0, Math.min(1, score)) : 0;
  const radius = (cfg.outer - cfg.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - normalizedScore);
  const displayScore = Number.isFinite(score) && score >= 0 ? Math.round(normalizedScore * 100) : "N/A";

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: cfg.outer, height: cfg.outer }}>
        <svg
          width={cfg.outer}
          height={cfg.outer}
          viewBox={`0 0 ${cfg.outer} ${cfg.outer}`}
          className="-rotate-90"
        >
          <circle
            cx={cfg.outer / 2}
            cy={cfg.outer / 2}
            r={radius}
            fill="none"
            strokeWidth={cfg.stroke}
            className="stroke-border/70"
          />
          <circle
            cx={cfg.outer / 2}
            cy={cfg.outer / 2}
            r={radius}
            fill="none"
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(getScoreRingClass(score), "transition-all duration-700 ease-out")}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-semibold", cfg.text, getScoreTextClass(score))}>{displayScore}</span>
        </div>
      </div>
      {label ? <span className={cn("font-medium text-muted-foreground", cfg.label)}>{label}</span> : null}
    </div>
  );
}

interface SeverityBadgeProps {
  severity: "low" | "medium" | "high" | "critical";
  className?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  low: "border-border/70 bg-surface-2 text-muted-foreground",
  medium: "border-warning/40 bg-warning/10 text-warning",
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  critical: "border-destructive/60 bg-destructive/15 text-destructive",
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <Badge
      className={cn(
        "h-5 px-1.5 text-[10px] font-medium capitalize",
        SEVERITY_STYLES[severity] || SEVERITY_STYLES.low,
        className
      )}
    >
      {severity}
    </Badge>
  );
}

interface DimensionBadgeProps {
  dimension: string;
  className?: string;
}

export function DimensionBadge({ dimension, className }: DimensionBadgeProps) {
  const label = dimension.replace(/_/g, " ");
  return (
    <Badge
      className={cn(
        "h-5 px-1.5 text-[10px] font-medium capitalize border-primary/25 bg-primary/10 text-primary",
        className
      )}
    >
      {label}
    </Badge>
  );
}

interface PatchDiffProps {
  original: string;
  suggested: string;
  rationale?: string;
  location?: string;
  className?: string;
}

export function PatchDiff({ original, suggested, rationale, location, className }: PatchDiffProps) {
  return (
    <div className={cn("overflow-hidden rounded-sm border border-border/50 bg-surface-2/35", className)}>
      {location ? (
        <div className="border-b border-border/40 px-3 py-2 text-[11px] font-mono text-muted-foreground">
          {location}
        </div>
      ) : null}

      <div className="grid grid-cols-1 divide-y divide-border/40 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="p-3">
          <div className="mb-1.5 text-[10px] font-medium text-destructive">
            Original
          </div>
          <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
            {original}
          </pre>
        </div>

        <div className="p-3">
          <div className="mb-1.5 text-[10px] font-medium text-primary">
            Suggested
          </div>
          <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
            {suggested}
          </pre>
        </div>
      </div>

      {rationale ? (
        <div className="border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Rationale:</span> {rationale}
        </div>
      ) : null}
    </div>
  );
}

interface ScoreBarProps {
  score: number;
  className?: string;
}

export function ScoreBar({ score, className }: ScoreBarProps) {
  const clampedScore = Number.isFinite(score) && score >= 0 ? Math.max(0, Math.min(1, score)) : 0;
  const percentage = Math.round(clampedScore * 100);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 rounded-sm bg-border/60">
        <div
          className={cn(
            "h-full rounded-sm transition-all duration-500 ease-out",
            getScoreTone(score) === "good"
              ? "bg-primary"
              : getScoreTone(score) === "medium"
                ? "bg-warning"
                : getScoreTone(score) === "low"
                  ? "bg-destructive"
                  : "bg-muted"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <span className={cn("w-9 text-right text-xs font-medium tabular-nums", getScoreTextClass(score))}>
        {Number.isFinite(score) && score >= 0 ? percentage : "N/A"}
      </span>
    </div>
  );
}
