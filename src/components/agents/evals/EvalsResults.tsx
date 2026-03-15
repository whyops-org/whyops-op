"use client";

import { useState } from "react";

import {
  EVAL_CATEGORY_LABELS,
  EVAL_DIFFICULTY_LABELS,
  type EvalCategory,
} from "@/constants/agent-evals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EvalCase, EvalRun } from "@/stores/agentEvalsStore";
import { EvalCaseCard } from "./EvalCaseCard";

interface EvalsResultsProps {
  run: EvalRun;
}

export function EvalsResults({ run }: EvalsResultsProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");

  const cases = run.cases || [];
  const summary = run.summary;
  const stats = summary?.pipelineStats;
  const coverage = summary?.toolsCoverage;

  const filtered = cases.filter((c) => {
    if (filterCategory !== "all" && c.category !== filterCategory) return false;
    if (filterDifficulty !== "all" && c.difficulty !== filterDifficulty) return false;
    return true;
  });

  const categoriesInCases = [...new Set(cases.map((c) => c.category))];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total Evals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{run.evalCount}</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Domain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-foreground">{summary?.domain || "—"}</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tool Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{coverage?.coveragePercent ?? "—"}%</p>
            {coverage?.uncovered && coverage.uncovered.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Uncovered: {coverage.uncovered.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Generated: <span className="font-medium text-foreground">{stats.candidatesGenerated}</span></p>
                <p>After validation: <span className="font-medium text-foreground">{stats.afterValidation}</span></p>
                <p>Critique rounds: <span className="font-medium text-foreground">{stats.critiqueRoundsRun}</span></p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      {summary?.categoryCounts && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.categoryCounts).map(([cat, count]) => (
            <Badge key={cat} className="px-3 py-1 text-xs">
              {EVAL_CATEGORY_LABELS[cat as EvalCategory] || cat}: {count as number}
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      {cases.length > 0 && (
        <div className="flex items-center gap-3">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoriesInCases.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {EVAL_CATEGORY_LABELS[cat as EvalCategory] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All difficulties</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground">
            {filtered.length} of {cases.length} eval{cases.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Eval case list */}
      <div className="space-y-3">
        {filtered.map((evalCase) => (
          <EvalCaseCard key={evalCase.id} evalCase={evalCase} />
        ))}
      </div>

      {cases.length === 0 && run.status === "completed" && (
        <p className="text-center text-sm text-muted-foreground py-6">
          No eval cases were generated in this run.
        </p>
      )}
    </div>
  );
}
