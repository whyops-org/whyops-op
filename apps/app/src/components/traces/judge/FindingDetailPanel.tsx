import { AlertTriangle, ChevronLeft, ChevronRight, ListChecks, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DiffViewer } from "@/components/ui/diff-viewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { JudgeFinding, JudgeIssue, JudgePatch } from "@/stores/judgeStore";
import { DimensionBadge, ScoreCircle, SeverityBadge } from "../judge-score";
import { ISSUES_PER_PAGE } from "./constants";
import { PatchedPromptDialog } from "./PatchedPromptDialog";
import { SystemPromptDialog } from "./SystemPromptDialog";
import type { FindingDetailTab } from "./types";
import {
  buildPatchSources,
  buildPatchedTextWithAllPatches,
  buildPromptAwarePatchDiff,
  formatScore,
  resolvePatchSource
} from "./utils";

const EMPTY_ISSUES: JudgeIssue[] = [];
const EMPTY_PATCHES: JudgePatch[] = [];

interface FindingDetailPanelProps {
  finding: JudgeFinding | null;
  systemPrompt: string;
  tools?: unknown[];
}

export function FindingDetailPanel({ finding, systemPrompt, tools }: FindingDetailPanelProps) {
  const [detailTab, setDetailTab] = useState<FindingDetailTab>("overview");
  const [issuePage, setIssuePage] = useState(0);
  const [selectedPatchIndex, setSelectedPatchIndex] = useState(0);
  const findingId = finding?.id ?? null;
  const issues = finding?.evidence?.issues ?? EMPTY_ISSUES;
  const patches = finding?.recommendation?.patches ?? EMPTY_PATCHES;
  const score = finding?.evidence?.score ?? -1;
  const issuePageCount = Math.max(1, Math.ceil(issues.length / ISSUES_PER_PAGE));
  const safeIssuePage = Math.min(issuePage, issuePageCount - 1);
  const pagedIssues = issues.slice(
    safeIssuePage * ISSUES_PER_PAGE,
    safeIssuePage * ISSUES_PER_PAGE + ISSUES_PER_PAGE
  );

  const safePatchIndex = Math.min(selectedPatchIndex, Math.max(0, patches.length - 1));
  const selectedPatch = patches[safePatchIndex] ?? null;
  const patchSources = useMemo(
    () => buildPatchSources({ systemPrompt, tools }),
    [systemPrompt, tools]
  );
  const patchResolutions = useMemo(
    () =>
      patches.map((patch) =>
        resolvePatchSource(patch, patchSources, finding?.dimension)
      ),
    [patches, patchSources, finding?.dimension]
  );

  const resolvedPatchSource = patchResolutions[safePatchIndex] ?? null;
  const sourceScopedPatches = useMemo(() => {
    if (!resolvedPatchSource || !selectedPatch) {
      return EMPTY_PATCHES;
    }

    if (resolvedPatchSource.source.kind === "generic") {
      return [selectedPatch];
    }

    return patches.filter(
      (_patch, index) =>
        patchResolutions[index]?.source.id === resolvedPatchSource.source.id
    );
  }, [patchResolutions, patches, resolvedPatchSource, selectedPatch]);

  const diffPayload = useMemo(() => {
    if (!selectedPatch || !resolvedPatchSource) {
      return null;
    }

    return buildPromptAwarePatchDiff(resolvedPatchSource.source.text, selectedPatch, {
      sourceLabel: resolvedPatchSource.source.title,
    });
  }, [selectedPatch, resolvedPatchSource]);

  const patchedSourcePayload = useMemo(() => {
    if (!resolvedPatchSource) {
      return null;
    }

    return buildPatchedTextWithAllPatches(
      resolvedPatchSource.source.text,
      sourceScopedPatches
    );
  }, [resolvedPatchSource, sourceScopedPatches]);

  useEffect(() => {
    setIssuePage(0);
    setSelectedPatchIndex(0);
  }, [findingId]);

  useEffect(() => {
    if (patches.length === 0) {
      return;
    }

    void import("react-diff-viewer-continued");
  }, [patches.length, findingId]);

  if (!finding) {
    return <EmptyPanel text="Select a finding to view details." />;
  }

  return (
    <div className="min-h-[34rem] space-y-4 rounded-sm border border-border/60 bg-background/80 p-4 lg:p-5">
      <div className="flex flex-col gap-3 border-b border-border/45 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <DimensionBadge dimension={finding.dimension} />
            <SeverityBadge severity={finding.severity} />
            {finding.stepId != null ? <Badge>Step {finding.stepId}</Badge> : null}
          </div>

          <p className="text-sm text-muted-foreground">
            Confidence {Math.round(finding.confidence * 100)}% • {issues.length} issue
            {issues.length === 1 ? "" : "s"} • {patches.length} patch
            {patches.length === 1 ? "" : "es"}
          </p>
        </div>

        <ScoreCircle score={score} size="sm" label="Score" />
      </div>

      <Tabs
        value={detailTab}
        onValueChange={(value) => setDetailTab(value as FindingDetailTab)}
        className="min-h-[26rem]"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="issues" className="text-sm">
            Issues
          </TabsTrigger>
          <TabsTrigger value="patches" className="text-sm">
            Patches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 min-h-[20rem] space-y-4">
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Recommendation
            </h4>
            <div className="rounded-sm border border-border/55 bg-surface-2/35 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{finding.recommendation.action}</span>
              {finding.recommendation.detail ? ` — ${finding.recommendation.detail}` : ""}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatPill label="Issues" value={String(issues.length)} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
            <StatPill label="Patches" value={String(patches.length)} icon={<Wrench className="h-3.5 w-3.5" />} />
            <StatPill label="Score" value={formatScore(score)} icon={<ListChecks className="h-3.5 w-3.5" />} />
          </div>

          {issues.length > 0 ? (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">
                Top Issues
              </h4>
              <div className="space-y-2">
                {issues.slice(0, 3).map((issue, index) => (
                  <div
                    key={`${issue.code}-${index}`}
                    className="rounded-sm border border-border/55 bg-surface-2/30 px-3 py-2.5"
                  >
                    <div className="mb-1 inline-flex rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {issue.code}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">{issue.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {patches.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setDetailTab("patches")}
            >
              Open Patch Diffs
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="issues" className="mt-4 min-h-[20rem] space-y-3">
          {issues.length === 0 ? (
            <EmptyPanel text="No issues for this finding." />
          ) : (
            <>
              <div className="h-[20rem] space-y-2 overflow-y-auto pr-1">
                {pagedIssues.map((issue, index) => (
                  <div
                    key={`${issue.code}-${safeIssuePage}-${index}`}
                    className="rounded-sm border border-border/55 bg-surface-2/25 px-3 py-3"
                  >
                    <div className="mb-1 inline-flex rounded-sm bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {issue.code}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">{issue.detail}</p>
                  </div>
                ))}
              </div>

              {issuePageCount > 1 ? (
                <div className="flex items-center justify-between border-t border-border/45 pt-3">
                  <p className="text-sm text-muted-foreground">
                    Page {safeIssuePage + 1} of {issuePageCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setIssuePage((prev) => Math.max(0, prev - 1))}
                      disabled={safeIssuePage === 0}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setIssuePage((prev) => Math.min(issuePageCount - 1, prev + 1))}
                      disabled={safeIssuePage >= issuePageCount - 1}
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="patches" className="mt-4 min-h-[20rem] space-y-3">
          {patches.length === 0 ? (
            <EmptyPanel text="No patches suggested for this finding." />
          ) : (
            <div className="space-y-3">
              <div className="space-y-2 rounded-sm border border-border/55 bg-surface-2/30 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Patch Selection
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {safePatchIndex + 1} of {patches.length}
                  </p>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {patches.map((patch, index) => {
                    const isActive = index === safePatchIndex;
                    const patchTitle = patch.location || `Patch ${index + 1}`;
                    return (
                      <button
                        key={`${patch.location || "patch"}-${index}`}
                        type="button"
                        onClick={() => setSelectedPatchIndex(index)}
                        className={cn(
                          "inline-flex h-8 flex-none items-center rounded-sm border px-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "border-primary/45 bg-primary/10 text-foreground"
                            : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
                        )}
                        title={patchTitle}
                      >
                        Patch {index + 1}
                      </button>
                    );
                  })}
                </div>


              </div>

              {diffPayload ? (
                <>
                  <div className="grid gap-2 rounded-sm border border-border/55 bg-surface-2/30 p-2 sm:grid-cols-2">
                    <div className="rounded-sm border border-border/55 bg-background/80 px-3 py-2">
                      <p className="text-sm font-semibold text-foreground">Diff Source</p>
                      <p className="text-sm text-foreground">
                        {resolvedPatchSource?.source.title || "Patch Text"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {resolvedPatchSource?.foundInSource
                          ? "Matched inside selected source context."
                          : "No direct match found. Showing patch-level comparison."}
                      </p>
                      <div className="mt-2">
                        {resolvedPatchSource ? (
                          <SystemPromptDialog
                            prompt={resolvedPatchSource.source.text}
                            buttonLabel="View Full Source"
                            title={resolvedPatchSource.source.title}
                            description="Full original source used for this patch diff."
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-sm flex flex-col justify-between border border-border/55 bg-background/80 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Patched Preview</p>
                          <p className="mb-2 text-sm text-muted-foreground">
                            Open the full source with patches for this source context applied.
                          </p>
                        </div>
                      {resolvedPatchSource && patchedSourcePayload ? (
                        <PatchedPromptDialog
                          patchedText={patchedSourcePayload.patchedText}
                          appliedCount={patchedSourcePayload.appliedCount}
                          totalCount={patchedSourcePayload.totalCount}
                          unappliedPatches={patchedSourcePayload.unappliedPatches}
                          title={`Patched ${resolvedPatchSource.source.title}`}
                          description="Full source preview after applying patches targeting this source."
                        />
                      ) : null}
                    </div>
                  </div>

                  <DiffViewer
                    oldValue={diffPayload.oldValue}
                    newValue={diffPayload.newValue}
                    leftTitle={diffPayload.leftTitle}
                    rightTitle={diffPayload.rightTitle}
                    splitView
                    showDiffOnly
                    extraLinesSurroundingDiff={8}
                  />

                  <div className="rounded-sm border border-border/55 bg-surface-2/30 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Rationale:</span>{" "}
                    {selectedPatch?.rationale || "No rationale provided."}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatPill({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-sm border border-border/55 bg-card px-2.5 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="ml-auto text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border/70 bg-surface-2/35 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
