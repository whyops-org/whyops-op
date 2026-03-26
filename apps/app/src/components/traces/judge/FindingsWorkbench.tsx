import { Filter } from "lucide-react";
import { useMemo, useState } from "react";

import { CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ALL_DIMENSIONS,
  DIMENSION_LABELS,
  type JudgeFinding,
} from "@/stores/judgeStore";
import {
  FINDING_CATEGORIES,
  FINDING_CATEGORY_LABELS,
} from "./constants";
import { FindingDetailPanel } from "./FindingDetailPanel";
import { FindingListItem } from "./FindingListItem";
import type { DimensionTab, FindingCategory } from "./types";

interface FindingsWorkbenchProps {
  findings: JudgeFinding[];
  systemPrompt: string;
  tools?: unknown[];
  isStreaming?: boolean;
}

export function FindingsWorkbench({
  findings,
  systemPrompt,
  tools,
  isStreaming = false,
}: FindingsWorkbenchProps) {
  const [dimensionTab, setDimensionTab] = useState<DimensionTab>("all");
  const [category, setCategory] = useState<FindingCategory>("all");
  const [activeFindingId, setActiveFindingId] = useState<string | null>(findings[0]?.id ?? null);

  const dimensionTabs = useMemo(
    () => [
      { value: "all" as const, label: "All Findings", count: findings.length },
      ...ALL_DIMENSIONS.map((dimension) => ({
        value: dimension,
        label: DIMENSION_LABELS[dimension],
        count: findings.filter((finding) => finding.dimension === dimension).length,
      })),
    ],
    [findings]
  );

  const findingsInTab = useMemo(() => {
    if (dimensionTab === "all") {
      return findings;
    }

    return findings.filter((finding) => finding.dimension === dimensionTab);
  }, [findings, dimensionTab]);

  const categoryCounts = useMemo(() => {
    const initialCounts: Record<FindingCategory, number> = {
      all: findingsInTab.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      patches: 0,
    };

    findingsInTab.forEach((finding) => {
      initialCounts[finding.severity] += 1;
      if ((finding.recommendation?.patches?.length ?? 0) > 0) {
        initialCounts.patches += 1;
      }
    });

    return initialCounts;
  }, [findingsInTab]);

  const filteredFindings = useMemo(() => {
    if (category === "all") {
      return findingsInTab;
    }

    if (category === "patches") {
      return findingsInTab.filter((finding) => (finding.recommendation?.patches?.length ?? 0) > 0);
    }

    return findingsInTab.filter((finding) => finding.severity === category);
  }, [findingsInTab, category]);

  const resolvedActiveFindingId = filteredFindings.some(
    (finding) => finding.id === activeFindingId
  )
    ? activeFindingId
    : (filteredFindings[0]?.id ?? null);

  const activeFinding =
    filteredFindings.find((finding) => finding.id === resolvedActiveFindingId) ?? null;

  return (
    <section className="rounded-sm border border-border/60 bg-surface-2/20">
      <div className="space-y-1 border-b border-border/55 px-5 py-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">Findings</CardTitle>
            {isStreaming ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <span className="h-1.5 w-1.5 bg-primary" />
                Streaming
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Filter the list, open a finding, then review issues and patch diffs in separate tabs.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <Tabs
          value={dimensionTab}
          onValueChange={(value) => {
            setDimensionTab(value as DimensionTab);
            setCategory("all");
            setActiveFindingId(null);
          }}
          className="min-h-[40rem]"
        >
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2"
          >
            {dimensionTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-9 flex-none rounded-sm border border-transparent px-3 text-sm font-medium data-[state=active]:border-border/70 data-[state=active]:bg-background/90"
              >
                {tab.label}
                <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs text-muted-foreground">
                  {tab.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={dimensionTab} className="mt-4 min-h-[35rem] space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Categories
              </span>

              {FINDING_CATEGORIES.map((categoryOption) => {
                const isActive = category === categoryOption;
                return (
                  <button
                    key={categoryOption}
                    type="button"
                    onClick={() => {
                      setCategory(categoryOption);
                      setActiveFindingId(null);
                    }}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded-sm border px-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {FINDING_CATEGORY_LABELS[categoryOption]}
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {categoryCounts[categoryOption]}
                    </span>
                  </button>
                );
              })}
            </div>

            {filteredFindings.length === 0 ? (
              <div className="flex min-h-[28rem] items-center justify-center rounded-sm border border-dashed border-border/70 bg-surface-2/35 px-4 py-10 text-center">
                <p className="text-base font-medium text-foreground">No findings in this view</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another category or dimension tab.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2 rounded-sm border border-border/55 bg-background/75 p-3">
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      Findings Strip
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(resolvedActiveFindingId
                        ? filteredFindings.findIndex((finding) => finding.id === resolvedActiveFindingId) + 1
                        : 0)} of {filteredFindings.length}
                    </p>
                  </div>

                  <div className="overflow-x-auto pb-1">
                    <div className="flex min-w-max gap-2">
                      {filteredFindings.map((finding) => (
                        <div key={finding.id} className="w-[320px] shrink-0">
                          <FindingListItem
                            finding={finding}
                            isActive={finding.id === resolvedActiveFindingId}
                            onClick={() => setActiveFindingId(finding.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <FindingDetailPanel finding={activeFinding} systemPrompt={systemPrompt} tools={tools} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
