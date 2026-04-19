"use client";

import { Lightbulb, Search, Wrench } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AgentAnalysisFinding } from "@/stores/agentAnalysisStore";

interface AgentFindingDetailPanelProps {
  finding: AgentAnalysisFinding | null;
}

export function AgentFindingDetailPanel({ finding }: AgentFindingDetailPanelProps) {
  if (!finding) {
    return (
      <section className="rounded-sm border border-dashed border-border/70 bg-surface-2/20 px-5 py-10 text-center">
        <p className="text-base leading-relaxed text-muted-foreground">Select a finding to inspect evidence, recommendation, and patches.</p>
      </section>
    );
  }

  return (
    <section className="rounded-sm border border-border/60 bg-card px-5 py-5">
      <div className="space-y-2 border-b border-border/55 pb-4">
        <p className="text-lg font-semibold text-foreground">{finding.title}</p>
        <p className="text-base leading-relaxed text-muted-foreground">{finding.detail}</p>
      </div>

      <Tabs defaultValue="evidence" className="mt-4 space-y-4">
        <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/50 bg-transparent p-0 pb-2">
          <TabsTrigger value="evidence" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Evidence</TabsTrigger>
          <TabsTrigger value="recommendation" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Recommendation</TabsTrigger>
          <TabsTrigger value="patches" className="h-9 flex-none rounded-sm px-3 text-sm font-medium">Patches</TabsTrigger>
        </TabsList>

        <TabsContent value="evidence" className="space-y-3">
          {(finding.evidence || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence snippets available.</p>
          ) : (
            (finding.evidence || []).map((evidence, index) => (
              <div key={`${finding.code}-evidence-${index}`} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  <Search className="mr-1 inline h-3.5 w-3.5" />
                  {evidence.signalType} {evidence.traceId ? `• ${evidence.traceId.slice(0, 8)}` : ""}
                </p>
                <p className="mt-2 text-base leading-relaxed text-foreground">{evidence.snippet}</p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="recommendation" className="space-y-3">
          <div className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
            <p className="text-sm text-muted-foreground">
              <Lightbulb className="mr-1 inline h-3.5 w-3.5" />
              {finding.recommendation?.action || "No action"}
            </p>
            <p className="mt-2 text-base leading-relaxed text-foreground">{finding.recommendation?.detail || "No recommendation detail provided."}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Owner: {finding.recommendation?.ownerType || "unknown"} • Fix type: {finding.recommendation?.fixType || "other"}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="patches" className="space-y-3">
          {(finding.patches || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No patch-ready suggestions for this finding.</p>
          ) : (
            (finding.patches || []).map((patch, index) => (
              <div key={`${finding.code}-patch-${index}`} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  <Wrench className="mr-1 inline h-3.5 w-3.5" />
                  {String((patch as { target?: string }).target || "patch")}
                </p>
                <pre className="mt-2 max-h-56 overflow-auto rounded-sm border border-border/50 bg-background/80 p-3 text-sm leading-relaxed text-foreground">
{JSON.stringify(patch, null, 2)}
                </pre>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
