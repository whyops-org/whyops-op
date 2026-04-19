"use client";

import { Filter } from "lucide-react";
import { useMemo, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AGENT_ANALYSIS_ALL_DIMENSIONS,
  AGENT_ANALYSIS_DIMENSION_LABELS,
  type AgentAnalysisDimension,
} from "@/constants/agent-analysis";
import type { AgentAnalysisFinding } from "@/stores/agentAnalysisStore";
import { AgentFindingDetailPanel } from "./AgentFindingDetailPanel";

type FindingCategory = "all" | "critical" | "high" | "medium" | "low" | "patches";
type DimensionTab = "all" | AgentAnalysisDimension;

interface AgentFindingsWorkbenchProps {
  findings: AgentAnalysisFinding[];
  isStreaming?: boolean;
}

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  all: "All",
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  patches: "With Patches",
};

const CATEGORY_ORDER: FindingCategory[] = ["all", "critical", "high", "medium", "low", "patches"];

function findingId(finding: AgentAnalysisFinding, index: number): string {
  return `${finding.dimension}:${finding.code}:${index}`;
}

export function AgentFindingsWorkbench({ findings, isStreaming = false }: AgentFindingsWorkbenchProps) {
  const [dimensionTab, setDimensionTab] = useState<DimensionTab>("all");
  const [category, setCategory] = useState<FindingCategory>("all");
  const [activeId, setActiveId] = useState<string | null>(findings[0] ? findingId(findings[0], 0) : null);

  const dimensionTabs = useMemo(
    () => [
      { value: "all" as const, label: "All Findings", count: findings.length },
      ...AGENT_ANALYSIS_ALL_DIMENSIONS.map((dimension) => ({
        value: dimension,
        label: AGENT_ANALYSIS_DIMENSION_LABELS[dimension],
        count: findings.filter((finding) => finding.dimension === dimension).length,
      })),
    ],
    [findings]
  );

  const findingsInTab = useMemo(() => {
    if (dimensionTab === "all") return findings;
    return findings.filter((finding) => finding.dimension === dimensionTab);
  }, [dimensionTab, findings]);

  const categoryCounts = useMemo(() => {
    const initial: Record<FindingCategory, number> = {
      all: findingsInTab.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      patches: 0,
    };

    findingsInTab.forEach((finding) => {
      initial[finding.severity] += 1;
      if ((finding.patches?.length || 0) > 0) initial.patches += 1;
    });

    return initial;
  }, [findingsInTab]);

  const filteredFindings = useMemo(() => {
    if (category === "all") return findingsInTab;
    if (category === "patches") return findingsInTab.filter((finding) => (finding.patches?.length || 0) > 0);
    return findingsInTab.filter((finding) => finding.severity === category);
  }, [category, findingsInTab]);

  const indexedFiltered = useMemo(
    () => filteredFindings.map((finding, index) => ({ finding, id: findingId(finding, index) })),
    [filteredFindings]
  );

  const resolvedActiveId = indexedFiltered.some((item) => item.id === activeId)
    ? activeId
    : (indexedFiltered[0]?.id ?? null);

  const activeFinding = indexedFiltered.find((item) => item.id === resolvedActiveId)?.finding ?? null;

  return (
    <section className="rounded-sm border border-border/60 bg-surface-2/20">
      <div className="space-y-1 border-b border-border/55 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-semibold text-foreground">Findings Workbench</p>
          {isStreaming ? (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 bg-primary" />
              Streaming
            </span>
          ) : null}
        </div>
        <p className="text-base leading-relaxed text-muted-foreground">Filter findings by dimension and severity, then inspect details and patches.</p>
      </div>

      <div className="space-y-5 px-5 py-5">
        <Tabs
          value={dimensionTab}
          onValueChange={(value) => {
            setDimensionTab(value as DimensionTab);
            setCategory("all");
            setActiveId(null);
          }}
          className="min-h-[34rem]"
        >
          <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2">
            {dimensionTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-10 flex-none rounded-sm border border-transparent px-3.5 text-sm font-medium data-[state=active]:border-border/70 data-[state=active]:bg-background/90"
              >
                {tab.label}
                <span className="rounded-sm bg-surface-2 px-2 py-0.5 text-sm text-muted-foreground">{tab.count}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={dimensionTab} className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Category
              </span>

              {CATEGORY_ORDER.map((categoryKey) => {
                const active = category === categoryKey;
                return (
                  <button
                    key={categoryKey}
                    type="button"
                    onClick={() => {
                      setCategory(categoryKey);
                      setActiveId(null);
                    }}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {CATEGORY_LABELS[categoryKey]}
                    <span className="text-sm tabular-nums text-muted-foreground">{categoryCounts[categoryKey]}</span>
                  </button>
                );
              })}
            </div>

            {indexedFiltered.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border/70 bg-surface-2/20 px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No findings in this view.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-3 rounded-sm border border-border/55 bg-background/75 p-4">
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-sm font-semibold text-foreground">Findings Strip</p>
                    <p className="text-sm text-muted-foreground">
                      {(resolvedActiveId
                        ? indexedFiltered.findIndex((item) => item.id === resolvedActiveId) + 1
                        : 0)} of {indexedFiltered.length}
                    </p>
                  </div>

                  <div className="overflow-x-auto pb-1">
                    <div className="flex min-w-max gap-2">
                      {indexedFiltered.map(({ finding, id }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveId(id)}
                          className={cn(
                            "w-[360px] rounded-sm border px-4 py-4 text-left transition-colors",
                            id === resolvedActiveId
                              ? "border-primary/45 bg-primary/10"
                              : "border-border/60 bg-background hover:bg-surface-2/30"
                          )}
                        >
                          <p className="truncate text-base font-semibold text-foreground">{finding.title}</p>
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{finding.detail}</p>
                          <p className="mt-3 text-sm text-muted-foreground">
                            {AGENT_ANALYSIS_DIMENSION_LABELS[finding.dimension as AgentAnalysisDimension] || finding.dimension} • {finding.severity}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <AgentFindingDetailPanel finding={activeFinding} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
