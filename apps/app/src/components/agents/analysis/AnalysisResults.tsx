"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  ListChecks,
  MessageSquareText,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  AGENT_ANALYSIS_DIMENSION_LABELS,
  type AgentAnalysisDimension,
} from "@/constants/agent-analysis";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AgentAnalysisActionPlanSection,
  AgentAnalysisDimensionScoresSection,
  AgentAnalysisExperimentsSection,
  AgentAnalysisFailureTaxonomySection,
  AgentAnalysisFollowupIntelligenceSection,
  AgentAnalysisIntentIntelligenceSection,
  AgentAnalysisOverviewSection,
  AgentAnalysisQualityIntelligenceSection,
  AgentAnalysisQueryIntelligenceSection,
  AgentAnalysisRecommendationsSection,
  AgentAnalysisRun,
  AgentAnalysisToolDiagnosticsSection,
  AgentAnalysisToolIntelligenceSection,
} from "@/stores/agentAnalysisStore";
import { cn } from "@/lib/utils";
import { formatDateTime, formatMetricNumber, formatPercent } from "./utils";
import { AgentFindingsWorkbench } from "./AgentFindingsWorkbench";

interface AnalysisResultsProps {
  run: AgentAnalysisRun;
  isStreaming?: boolean;
}

interface BarItem {
  label: string;
  value: number;
  hint?: string;
}

interface InsightBucket {
  key: string;
  label: string;
  items: string[];
}

function getStatusClass(status: AgentAnalysisRun["status"]): string {
  if (status === "completed") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "failed") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-warning/30 bg-warning/10 text-warning";
}

function severityClass(severity: "low" | "medium" | "high" | "critical"): string {
  if (severity === "critical") return "text-destructive";
  if (severity === "high") return "text-warning";
  if (severity === "medium") return "text-primary";
  return "text-muted-foreground";
}

function toPercent(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value * 100));
}

function formatDimensionLabel(dimension: string): string {
  const label = AGENT_ANALYSIS_DIMENSION_LABELS[dimension as AgentAnalysisDimension];
  return label || dimension.replace(/_/g, " ");
}

function dimensionScoreBadgeClass(score: number): string {
  if (score < 0.25) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (score < 0.45) return "border-warning/30 bg-warning/10 text-warning";
  if (score < 0.7) return "border-primary/30 bg-primary/10 text-primary";
  return "border-border/60 bg-surface-2/40 text-foreground";
}

function sanitizeText(value: string): string {
  return value
    .replace(/\[(?:image|img)\s*#?\d+\]/gi, " ")
    .replace(/<image[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value: string, max = 140): string {
  const normalized = sanitizeText(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

function firstPoint(value: string): string {
  const normalized = sanitizeText(value);
  if (!normalized) return "No summary generated for this dimension.";
  const [firstSentence] = normalized.split(/(?<=[.!?])\s+/);
  return truncateText(firstSentence || normalized, 140);
}

function normalizeBars(items: BarItem[], limit = 8): BarItem[] {
  return items
    .filter((item) => item.label.trim().length > 0 && Number.isFinite(item.value) && item.value >= 0)
    .slice(0, limit);
}

function severitySortKey(severity: string): number {
  if (severity === "critical") return 0;
  if (severity === "high") return 1;
  if (severity === "medium") return 2;
  return 3;
}

function trendLabel(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "-";
  if (delta > 0) return `+${delta.toFixed(2)}`;
  return delta.toFixed(2);
}

function trendClass(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) {
    return "border-border/60 bg-surface-2/40 text-muted-foreground";
  }
  if (delta > 0) return "border-primary/30 bg-primary/10 text-primary";
  if (delta < 0) return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border/60 bg-surface-2/40 text-muted-foreground";
}

export function AnalysisResults({ run, isStreaming = false }: AnalysisResultsProps) {
  const overview = run.sections?.overview as AgentAnalysisOverviewSection | undefined;
  const query = run.sections?.query_intelligence as AgentAnalysisQueryIntelligenceSection | undefined;
  const followup = run.sections?.followup_intelligence as AgentAnalysisFollowupIntelligenceSection | undefined;
  const intent = run.sections?.intent_intelligence as AgentAnalysisIntentIntelligenceSection | undefined;
  const tools = run.sections?.tool_intelligence as AgentAnalysisToolIntelligenceSection | undefined;
  const quality = run.sections?.quality_intelligence as AgentAnalysisQualityIntelligenceSection | undefined;
  const dimensionScores =
    run.sections?.dimension_scores as AgentAnalysisDimensionScoresSection | undefined;
  const failureTaxonomy =
    run.sections?.failure_taxonomy as AgentAnalysisFailureTaxonomySection | undefined;
  const toolDiagnostics =
    run.sections?.tool_diagnostics as AgentAnalysisToolDiagnosticsSection | undefined;
  const actionPlan = run.sections?.action_plan as AgentAnalysisActionPlanSection | undefined;
  const experiments = run.sections?.experiments as AgentAnalysisExperimentsSection | undefined;
  const recommendations = run.sections?.recommendations as AgentAnalysisRecommendationsSection | undefined;
  const checkpoint = run.summary?.checkpoint;

  const findings = run.findings || [];

  const topInitialQueryBars = normalizeBars(
    (query?.topInitialQueries || []).map((item) => ({
      label: sanitizeText(item.query),
      value: Number(item.count || 0),
      hint: `${item.count} traces`,
    }))
  );

  const highErrorQueryBars = normalizeBars(
    (query?.topHighErrorQueries || []).map((item) => ({
      label: sanitizeText(item.query),
      value: Number(item.errorRate || 0),
      hint: `${item.traceCount} traces`,
    }))
  );

  const topFollowupBars = normalizeBars(
    (followup?.topFollowups || []).map((item) => ({
      label: sanitizeText(item.query),
      value: Number(item.count || 0),
      hint: `${item.count} times`,
    }))
  );

  const followupIntentBars = normalizeBars(
    Object.entries(followup?.intentCategories || {}).map(([key, count]) => ({
      label: key.replace(/_/g, " "),
      value: Number(count || 0),
    }))
  );

  const severityBars = normalizeBars(
    Object.entries(quality?.severityDistribution || {})
      .sort((a, b) => severitySortKey(a[0]) - severitySortKey(b[0]))
      .map(([severity, count]) => ({
        label: severity,
        value: Number(count || 0),
      }))
  );

  const firstQueryIntentBars = normalizeBars(
    (query?.topFirstQueryIntents || []).map((item) => ({
      label: item.intent.replace(/_/g, " "),
      value: Number(item.count || 0),
      hint: `${item.share.toFixed(1)}% share`,
    }))
  );

  const firstQueryIntentOutcomes = (query?.firstQueryIntentOutcomes || []).slice(0, 8);
  const topIntentsNeedingDevelopment = (query?.topIntentsNeedingDevelopment || []).slice(0, 6);

  const topResolvedToolBars = normalizeBars(
    (tools?.effectiveness?.topResolvedTools || []).map((item) => ({
      label: item.toolName,
      value: Number(item.likelyResolvedRate || 0),
      hint: `${item.traces} traces`,
    }))
  );

  const underperformingToolBars = normalizeBars(
    (tools?.effectiveness?.underperformingTools || []).map((item) => ({
      label: item.toolName,
      value: Number(item.errorRate + item.followupRate + item.arbitraryCallRate || 0),
      hint: `Err ${item.errorRate.toFixed(1)}% | Fup ${item.followupRate.toFixed(1)}%`,
    }))
  );

  return (
    <div className="space-y-5">
      <Card className="border-border/60 bg-card px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold text-foreground">
                {run.status === "completed"
                  ? "Deep Agent Analysis Complete"
                  : run.status === "failed"
                    ? "Agent Analysis Failed"
                    : "Deep Agent Analysis Running"}
              </p>
              <Badge className={cn("h-6 px-2 text-xs capitalize", getStatusClass(run.status))}>
                {run.status}
              </Badge>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
              <MetaField label="Mode" value={String(run.summary?.mode || "standard")} />
              <MetaField label="Window" value={`${run.summary?.lookbackDays || 14} days`} />
              <MetaField label="Dimensions" value={String(run.summary?.dimensionCount || 0)} />
              <MetaField label="Traces" value={String(run.traceCount)} />
              <MetaField label="Findings" value={String(run.summary?.findingCount || findings.length)} />
            </div>
            <p className="text-sm text-muted-foreground">
              Window: {formatDateTime(run.windowStart)} - {formatDateTime(run.windowEnd)}
            </p>
          </div>
          <div className="space-y-2 text-right text-sm text-muted-foreground">
            <p>Started: {formatDateTime(run.startedAt)}</p>
            <p>Finished: {formatDateTime(run.finishedAt)}</p>
            <p>
              Overall Score:{" "}
              <span className="font-semibold text-foreground">
                {typeof dimensionScores?.overallScore === "number"
                  ? `${Math.round(dimensionScores.overallScore * 100)}%`
                  : "N/A"}
              </span>
            </p>
          </div>
        </div>

        {checkpoint && (isStreaming || run.status === "running") ? (
          <div className="mt-4 rounded-sm border border-border/60 bg-surface-2/30 px-4 py-3 text-base text-muted-foreground">
            <span className="font-medium text-foreground">Checkpoint:</span> {checkpoint.key} (#{checkpoint.sequence})
          </div>
        ) : null}
      </Card>

      <Tabs defaultValue="dimensions" className="space-y-4">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2"
        >
          <TabsTrigger value="overview" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Overview</TabsTrigger>
          <TabsTrigger value="query" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Query & Intent</TabsTrigger>
          <TabsTrigger value="dimensions" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Dimension Scores</TabsTrigger>
          <TabsTrigger value="findings" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Findings</TabsTrigger>
          <TabsTrigger value="diagnostics" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Tool & Quality</TabsTrigger>
          <TabsTrigger value="actions" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Action Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          {overview ? (
            <Card className="border-border/60 bg-card px-5 py-5">
              <SectionTitle icon={<Gauge className="h-4 w-4" />} title="Overview" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Active Days" value={formatMetricNumber(overview.activeDays)} />
                <MetricCard label="Multi-turn Rate" value={formatPercent(overview.multiTurnRate)} />
                <MetricCard label="Error Rate" value={formatPercent(overview.errorRate)} />
                <MetricCard label="Tool Call Rate" value={formatPercent(overview.toolCallRate)} />
                <MetricCard label="Avg Latency" value={formatMetricNumber(overview.avgLatencyMs, " ms")} />
                <MetricCard label="P50 Latency" value={formatMetricNumber(overview.p50LatencyMs, " ms")} />
                <MetricCard label="P90 Latency" value={formatMetricNumber(overview.p90LatencyMs, " ms")} />
                <MetricCard label="Total Tokens" value={formatMetricNumber(overview.totalTokens)} />
              </div>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="query" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="border-border/60 bg-card px-5 py-5">
              <SectionTitle icon={<MessageSquareText className="h-4 w-4" />} title="Query Intelligence" />

              <Tabs defaultValue="signals" className="mt-4 space-y-3">
                <TabsList
                  variant="line"
                  className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2"
                >
                  <TabsTrigger value="signals" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Signals
                  </TabsTrigger>
                  <TabsTrigger value="intent-outcomes" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Intent Outcomes
                  </TabsTrigger>
                  <TabsTrigger value="llm-analysis" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    LLM Analysis
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signals" className="space-y-3">
                  <InsightHeader
                    title="LLM Read"
                    headline={query?.llmInsights?.headline}
                    fallback="No LLM query insight available yet."
                  />
                  <BarList
                    title="Top Initial Queries"
                    items={topInitialQueryBars}
                    formatter={(value) => `${value.toFixed(0)}`}
                  />
                  <BarList
                    title="High Error Query Classes"
                    items={highErrorQueryBars}
                    formatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <BarList
                    title="First-Query Intent Demand"
                    items={firstQueryIntentBars}
                    formatter={(value) => `${value.toFixed(0)}`}
                  />
                </TabsContent>

                <TabsContent value="intent-outcomes" className="space-y-3">
                  <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      First-Query Intent Outcomes
                    </p>
                    {(firstQueryIntentOutcomes || []).length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No intent outcomes generated in this run.</p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {firstQueryIntentOutcomes.map((item) => (
                          <div
                            key={item.intent}
                            className="rounded-sm border border-border/50 bg-background/60 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">{item.intent.replace(/_/g, " ")}</p>
                              <span className="text-sm text-muted-foreground">{item.traceCount} traces</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge className="border-border/60 bg-surface-2/40 text-foreground">
                                Resolve {item.likelyResolvedRate.toFixed(1)}%
                              </Badge>
                              <Badge className="border-border/60 bg-surface-2/40 text-foreground">
                                Error {item.errorRate.toFixed(1)}%
                              </Badge>
                              <Badge className="border-border/60 bg-surface-2/40 text-foreground">
                                Follow-up {item.followupRate.toFixed(1)}%
                              </Badge>
                              <Badge className="border-border/60 bg-surface-2/40 text-foreground">
                                Tool Miss {item.expectedToolMissRate.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Intents Needing Development
                    </p>
                    {(topIntentsNeedingDevelopment || []).length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No high-risk intent groups identified.</p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {topIntentsNeedingDevelopment.map((item) => (
                          <div
                            key={`${item.intent}-${item.traceCount}`}
                            className="rounded-sm border border-border/50 bg-background/60 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">{item.intent.replace(/_/g, " ")}</p>
                              <span className="text-sm text-warning">
                                Need {item.developmentNeedScore.toFixed(1)}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {(item.reasons || []).slice(0, 4).map((reason) => (
                                <Badge
                                  key={`${item.intent}-${reason}`}
                                  className="border-border/60 bg-surface-2/40 text-foreground"
                                >
                                  {truncateText(reason, 40)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="llm-analysis" className="space-y-3">
                  <InsightTabsPanel
                    title="Query Intelligence Breakdown"
                    buckets={[
                      { key: "themes", label: "Themes", items: query?.llmInsights?.keyThemes || [] },
                      { key: "friction", label: "Friction", items: query?.llmInsights?.frictionPoints || [] },
                      { key: "opportunities", label: "Opportunities", items: query?.llmInsights?.opportunities || [] },
                      { key: "actions", label: "Actions", items: query?.llmInsights?.actionHints || [] },
                    ]}
                    emptyText="No LLM query insights available yet."
                  />
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="border-border/60 bg-card px-5 py-5">
              <SectionTitle icon={<MessageSquareText className="h-4 w-4" />} title="Follow-up & Intent" />

              <Tabs defaultValue="signals" className="mt-4 space-y-3">
                <TabsList
                  variant="line"
                  className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2"
                >
                  <TabsTrigger value="signals" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Signals
                  </TabsTrigger>
                  <TabsTrigger value="intent-map" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Intent Map
                  </TabsTrigger>
                  <TabsTrigger value="llm-analysis" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    LLM Analysis
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signals" className="space-y-3">
                  <InsightHeader
                    title="LLM Read"
                    headline={followup?.llmInsights?.headline}
                    fallback="No LLM follow-up insight available yet."
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MetricChip label="Follow-up Rate" value={formatPercent(followup?.followupRate)} />
                    <MetricChip label="Avg Turns / Trace" value={formatMetricNumber(followup?.avgTurnsPerTrace)} />
                    <MetricChip label="Looping Traces" value={formatMetricNumber(followup?.loopingTraces)} />
                  </div>
                  <BarList
                    title="Top Follow-up Queries"
                    items={topFollowupBars}
                    formatter={(value) => `${value.toFixed(0)}`}
                  />
                  <BarList
                    title="Follow-up Intent Categories"
                    items={followupIntentBars}
                    formatter={(value) => `${value.toFixed(0)}`}
                  />
                </TabsContent>

                <TabsContent value="intent-map" className="space-y-3">
                  <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Top Intent Clusters
                    </p>
                    {(intent?.topIntentClusters || []).length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No intent clusters generated in this run.</p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {(intent?.topIntentClusters || []).slice(0, 8).map((cluster) => (
                          <div
                            key={`${cluster.clusterKey}-${cluster.sampleQuery}`}
                            className="rounded-sm border border-border/50 bg-background/60 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {cluster.clusterKey.replace(/_/g, " ")}
                              </p>
                              <span className="text-sm text-muted-foreground">{cluster.count} traces</span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                              {truncateText(cluster.sampleQuery, 120)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {Object.keys(intent?.intentDistribution || {}).length > 0 ? (
                    <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        Intent Distribution
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(intent?.intentDistribution || {})
                          .slice(0, 10)
                          .map(([key, value]) => (
                            <Badge key={key} className="border-border/60 bg-surface-2/35 text-foreground">
                              {key.replace(/_/g, " ")}: {value.toFixed(1)}%
                            </Badge>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="llm-analysis" className="space-y-3">
                  <InsightTabsPanel
                    title="Follow-up Intelligence Breakdown"
                    buckets={[
                      {
                        key: "why-followup",
                        label: "Why Follow-up",
                        items: followup?.llmInsights?.whyUsersFollowUp || [],
                      },
                      {
                        key: "unresolved",
                        label: "Unresolved",
                        items: followup?.llmInsights?.unresolvedPatterns || [],
                      },
                      {
                        key: "repairs",
                        label: "Repairs",
                        items: followup?.llmInsights?.repairOpportunities || [],
                      },
                      {
                        key: "actions",
                        label: "Actions",
                        items: followup?.llmInsights?.actionHints || [],
                      },
                    ]}
                    emptyText="No LLM follow-up insights available yet."
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dimensions" className="space-y-5">
          {dimensionScores ? (
            <Card className="border-border/60 bg-card px-5 py-5">
              <SectionTitle icon={<ShieldAlert className="h-4 w-4" />} title="Dimension Scores" />

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <MetricCard
                  label="Overall Score"
                  value={`${Math.round((dimensionScores.overallScore || 0) * 100)}%`}
                />
                <MetricCard label="Total Issues" value={formatMetricNumber(dimensionScores.totalIssues)} />
                <MetricCard
                  label="Critical + High"
                  value={formatMetricNumber(
                    Number(dimensionScores.bySeverity?.critical || 0) + Number(dimensionScores.bySeverity?.high || 0)
                  )}
                />
                <MetricCard
                  label="Failed Dimensions"
                  value={formatMetricNumber(Object.keys(dimensionScores.failures || {}).length)}
                />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {(["critical", "high", "medium", "low"] as const).map((severity) => (
                  <div key={severity} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3">
                    <p className="text-sm capitalize text-muted-foreground">{severity}</p>
                    <p className={cn("mt-1 text-base font-semibold", severityClass(severity))}>
                      {dimensionScores.bySeverity?.[severity] || 0}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {dimensionScores.dimensions.map((dimension) => (
                  <div
                    key={dimension.dimension}
                    className="rounded-sm border border-border/55 bg-surface-2/20 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{formatDimensionLabel(dimension.dimension)}</p>
                      <Badge className={cn("", dimensionScoreBadgeClass(dimension.score))}>
                        {Math.round(dimension.score * 100)}%
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{firstPoint(dimension.summary)}</p>

                    <div className="mt-3 space-y-1.5">
                      <Progress value={Math.max(0, Math.min(100, dimension.score * 100))} />
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Issues: {dimension.issueCount}</span>
                        <span className={severityClass(dimension.severity)}>{dimension.severity}</span>
                      </div>
                    </div>

                    <CompactPoints title="Strengths" items={dimension.strengths} emptyLabel="No stable strengths yet." />
                    <CompactPoints title="Needs Work" items={dimension.weaknesses} emptyLabel="No weaknesses reported." />
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="border-border/60 bg-card px-5 py-5">
            <SectionTitle icon={<AlertTriangle className="h-4 w-4" />} title="Failure Taxonomy" />
            <div className="mt-4 space-y-3">
              {(failureTaxonomy?.patterns || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No failure taxonomy patterns generated.</p>
              ) : (
                failureTaxonomy?.patterns.slice(0, 10).map((pattern) => (
                  <div key={pattern.code} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{pattern.title}</p>
                      <span className={cn("text-sm font-medium capitalize", severityClass(pattern.severity))}>{pattern.severity}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{truncateText(pattern.summary, 180)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="findings" className="space-y-5">
          {findings.length > 0 ? (
            <AgentFindingsWorkbench findings={findings} isStreaming={isStreaming} />
          ) : (
            <section className="flex items-center gap-2 rounded-sm border border-border/60 bg-surface-2/20 px-4 py-5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {isStreaming
                ? "Waiting for structured findings. This section updates as streaming continues."
                : "No findings were reported for this analysis."}
            </section>
          )}
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="border-border/60 bg-card px-5 py-5">
              <SectionTitle icon={<Wrench className="h-4 w-4" />} title="Tool Diagnostics" />
              <Tabs defaultValue="routing" className="mt-4 space-y-3">
                <TabsList
                  variant="line"
                  className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2"
                >
                  <TabsTrigger value="routing" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Routing
                  </TabsTrigger>
                  <TabsTrigger value="effectiveness" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Effectiveness
                  </TabsTrigger>
                  <TabsTrigger value="catalog" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Tool Catalog
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="routing" className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MetricChip
                      label="Routing Recall"
                      value={formatPercent(tools?.routingAssessment?.routingRecall)}
                    />
                    <MetricChip
                      label="Routing Precision"
                      value={formatPercent(tools?.routingAssessment?.routingPrecision)}
                    />
                    <MetricChip
                      label="Arbitrary Tool Calls"
                      value={formatPercent(tools?.routingAssessment?.arbitraryCallRate)}
                    />
                  </div>
                  <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3 text-sm text-muted-foreground">
                    Expected Tool Traces:{" "}
                    <span className="font-medium text-foreground">{tools?.routingAssessment?.expectedToolTraces ?? 0}</span>{" "}
                    | Called:{" "}
                    <span className="font-medium text-foreground">{tools?.routingAssessment?.expectedAndCalled ?? 0}</span>{" "}
                    | Missed:{" "}
                    <span className="font-medium text-foreground">{tools?.routingAssessment?.expectedButMissed ?? 0}</span>{" "}
                    | Called Without Need:{" "}
                    <span className="font-medium text-foreground">{tools?.routingAssessment?.calledWithoutNeed ?? 0}</span>
                  </div>
                </TabsContent>

                <TabsContent value="effectiveness" className="space-y-3">
                  <BarList
                    title="Tools Solving Users Most"
                    items={topResolvedToolBars}
                    formatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <BarList
                    title="Underperforming Tool Patterns"
                    items={underperformingToolBars}
                    formatter={(value) => `${value.toFixed(1)}`}
                  />
                </TabsContent>

                <TabsContent value="catalog" className="space-y-3">
                  {(tools?.tools || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tool call data in this run.</p>
                  ) : (
                    tools?.tools.slice(0, 8).map((tool) => (
                      <div key={tool.toolName} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{tool.toolName}</p>
                          <p className="text-sm text-muted-foreground">{tool.calls} calls</p>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Success {formatPercent(tool.likelySuccessRate)} | Retries {tool.retries} | Avg latency{" "}
                          {formatMetricNumber(tool.avgLatencyMs, " ms")}
                        </p>
                      </div>
                    ))
                  )}
                  {(toolDiagnostics?.systemicIssues || []).slice(0, 3).map((issue) => (
                    <div key={issue.title} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{issue.title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{truncateText(issue.detail, 180)}</p>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="border-border/60 bg-card px-5 py-5">
              <SectionTitle icon={<Clock3 className="h-4 w-4" />} title="Quality Intelligence" />
              <Tabs defaultValue="signals" className="mt-4 space-y-3">
                <TabsList
                  variant="line"
                  className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2"
                >
                  <TabsTrigger value="signals" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Signals
                  </TabsTrigger>
                  <TabsTrigger value="trends" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    Trends
                  </TabsTrigger>
                  <TabsTrigger value="llm-analysis" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                    LLM Analysis
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signals" className="space-y-3">
                  <InsightHeader
                    title="LLM Read"
                    headline={quality?.llmInsights?.headline}
                    fallback="No LLM quality insight available yet."
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <MetricChip
                      label="Judge Sample Traces"
                      value={formatMetricNumber(quality?.analyzedTraceCount || 0)}
                    />
                    <MetricChip
                      label="Recovery Rate"
                      value={formatPercent(quality?.reliability?.recoveryRate || 0)}
                    />
                  </div>
                  <BarList
                    title="Finding Severity Distribution"
                    items={severityBars}
                    formatter={(value) => `${value.toFixed(0)}`}
                  />
                </TabsContent>

                <TabsContent value="trends" className="space-y-2">
                  {Object.entries(quality?.dimensionAverages || {})
                    .slice(0, 8)
                    .map(([dimension, score]) => {
                      const delta = quality?.dimensionTrendVsPreviousRun?.[dimension] ?? null;
                      return (
                        <div key={dimension} className="space-y-2 rounded-sm border border-border/55 bg-surface-2/20 px-3.5 py-3">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">{dimension.replace(/_/g, " ")}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{formatPercent(toPercent(score))}</span>
                              <Badge className={cn("", trendClass(delta))}>{trendLabel(delta)}</Badge>
                            </div>
                          </div>
                          <Progress value={toPercent(score)} />
                        </div>
                      );
                    })}
                </TabsContent>

                <TabsContent value="llm-analysis" className="space-y-3">
                  <InsightTabsPanel
                    title="Quality Intelligence Breakdown"
                    buckets={[
                      { key: "causes", label: "Root Causes", items: quality?.llmInsights?.rootCauses || [] },
                      {
                        key: "reliability",
                        label: "Reliability",
                        items: quality?.llmInsights?.reliabilityRisks || [],
                      },
                      {
                        key: "efficiency",
                        label: "Cost & Latency",
                        items: quality?.llmInsights?.costLatencyDrivers || [],
                      },
                      { key: "actions", label: "Actions", items: quality?.llmInsights?.actionHints || [] },
                    ]}
                    emptyText="No LLM quality insights available yet."
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-5">
          <Card className="border-border/60 bg-card px-5 py-5">
            <SectionTitle icon={<ListChecks className="h-4 w-4" />} title="Execution Plan" />
            <Tabs defaultValue="actions" className="mt-4 space-y-3">
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2"
              >
                <TabsTrigger value="actions" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                  Action Plan
                </TabsTrigger>
                <TabsTrigger value="experiments" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                  Experiments
                </TabsTrigger>
                <TabsTrigger value="recommendations" className="h-9 flex-none rounded-sm px-3.5 text-sm font-medium">
                  Recommendations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="actions" className="space-y-3">
                {(actionPlan?.items || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No action plan items generated.</p>
                ) : (
                  actionPlan?.items.slice(0, 10).map((item) => (
                    <div key={`${item.priority}-${item.title}`} className="rounded-sm border border-border/55 bg-surface-2/20 px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          P{item.priority} - {item.title}
                        </p>
                        <span className={cn("text-sm font-medium capitalize", severityClass(item.severity))}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="experiments" className="space-y-3">
                {(experiments?.items || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No experiments proposed.</p>
                ) : (
                  experiments?.items.slice(0, 10).map((experiment) => (
                    <div key={experiment.name} className="rounded-sm border border-border/55 bg-surface-2/20 px-3 py-3">
                      <p className="text-sm font-semibold text-foreground">{experiment.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{experiment.hypothesis}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Metric: {experiment.metric} | Risk: {experiment.risk} | Effort: {experiment.effort}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-3">
                {(recommendations?.items || []).length === 0 ? (
                  <div className="flex items-center gap-2 rounded-sm border border-border/55 bg-surface-2/20 px-3 py-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    No recommendations generated.
                  </div>
                ) : (
                  recommendations?.items.map((item) => (
                    <div key={`${item.priority}-${item.title}`} className="rounded-sm border border-border/55 bg-surface-2/20 px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          P{item.priority} - {item.title}
                        </p>
                        <span className={cn("text-sm font-medium capitalize", severityClass(item.severity))}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
      {icon}
      {title}
    </p>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-sm border border-border/55 bg-surface-2/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border/55 bg-surface-2/20 px-3.5 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InsightHeader({
  title,
  headline,
  fallback,
}: {
  title: string;
  headline?: string;
  fallback: string;
}) {
  return (
    <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-base leading-relaxed text-foreground">{headline ? truncateText(headline, 180) : fallback}</p>
    </div>
  );
}

function InsightTabsPanel({
  title,
  buckets,
  emptyText,
}: {
  title: string;
  buckets: InsightBucket[];
  emptyText: string;
}) {
  const normalized = buckets
    .map((bucket) => ({
      ...bucket,
      items: (bucket.items || [])
        .map((item) => truncateText(item, 180))
        .filter((item) => item.length > 0)
        .slice(0, 6),
    }))
    .filter((bucket) => bucket.items.length > 0);

  if (normalized.length === 0) {
    return (
      <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <Tabs defaultValue={normalized[0].key} className="mt-3 space-y-3">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2"
        >
          {normalized.map((bucket) => (
            <TabsTrigger key={bucket.key} value={bucket.key} className="h-9 flex-none rounded-sm px-3 text-sm font-medium">
              {bucket.label}
              <span className="ml-1 rounded-sm border border-border/60 bg-surface-2/40 px-1.5 py-0.5 text-xs leading-none">
                {bucket.items.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {normalized.map((bucket) => (
          <TabsContent key={bucket.key} value={bucket.key} className="mt-0">
            <div className="grid gap-2 sm:grid-cols-2">
              {bucket.items.map((item, index) => (
                <div
                  key={`${bucket.key}-${item}`}
                  className="flex items-start gap-3 rounded-sm border border-border/50 bg-background/60 px-3 py-3"
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-sm border border-border/60 bg-surface-2/40 text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CompactPoints({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  const cleaned = items.map((item) => truncateText(item, 120)).filter((item) => item.length > 0).slice(0, 2);

  return (
    <div className="mt-3 space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {cleaned.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {cleaned.map((item, index) => (
            <div key={item} className="flex items-start gap-2.5 rounded-sm border border-border/50 bg-background/50 px-3 py-2.5">
              <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-sm border border-border/60 bg-surface-2/40 text-xs font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BarList({
  title,
  items,
  formatter,
}: {
  title: string;
  items: BarItem[];
  formatter: (value: number) => string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">No data in this section.</p>
      </div>
    );
  }

  const max = items.reduce((acc, item) => Math.max(acc, item.value), 0) || 1;

  return (
    <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((item) => {
          const width = Math.max(6, Math.round((item.value / max) * 100));
          return (
            <div key={`${item.label}-${item.value}`} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="max-w-[70%] text-muted-foreground">{truncateText(item.label, 110)}</span>
                <span className="font-medium text-foreground">{formatter(item.value)}</span>
              </div>
              <div className="h-2 rounded-sm bg-surface-3/70">
                <div className="h-full rounded-sm bg-primary/75" style={{ width: `${width}%` }} />
              </div>
              {item.hint ? <p className="text-sm text-muted-foreground">{item.hint}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
