"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { JudgePanel } from "@/components/traces/judge-panel";
import { TraceCanvas } from "@/components/traces/trace-canvas";
import { TraceHeader } from "@/components/traces/trace-header";
import { TraceSidebarLeft } from "@/components/traces/trace-sidebar-left";
import { TraceSidebarRight } from "@/components/traces/trace-sidebar-right";
import { TraceTimeline } from "@/components/traces/trace-timeline";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";
import { useTraceDetailStore } from "@/stores/traceDetailStore";
import { ReactFlowProvider } from "reactflow";

export function TraceDetailsPageContent() {
  const params = useParams();
  const traceId = params.traceId as string;
  const agentId = params.agentId as string;

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [view, setView] = useState<"graph" | "timeline" | "judge">("graph");
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const isJudgeView = view === "judge";

  const config = useConfigStore((state) => state.config);
  const { trace, isLoading, fetchTrace } = useTraceDetailStore();

  useEffect(() => {
    if (traceId && config?.analyseBaseUrl) {
      fetchTrace(traceId).finally(() => {
        setHasAttemptedLoad(true);
      });
    }
  }, [traceId, config?.analyseBaseUrl, fetchTrace]);

  const shouldShowInitialLoader =
    !hasAttemptedLoad || isLoading || (config?.analyseBaseUrl && !trace && !isLoading);

  if (shouldShowInitialLoader) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-background">
        <Spinner className="h-8 w-8 border-2 border-border border-t-foreground" />
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-background">
        <p className="text-muted-foreground">Trace not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden bg-background text-foreground">
      <TraceHeader
        trace={trace}
        view={view}
        onViewChange={setView}
        agentId={trace.agentId || agentId}
      />

      <div className="flex flex-1 overflow-hidden">
        {!isJudgeView ? (
          <TraceSidebarLeft
            trace={trace}
            isCollapsed={leftCollapsed}
            onToggle={() => setLeftCollapsed(!leftCollapsed)}
          />
        ) : null}

        <div
          className={cn(
            "relative flex-1 overflow-hidden",
            !isJudgeView && "border-x border-border/50"
          )}
        >
          {view === "graph" ? (
            <ReactFlowProvider>
              <TraceCanvas trace={trace} />
            </ReactFlowProvider>
          ) : view === "timeline" ? (
            <TraceTimeline trace={trace} />
          ) : (
            <JudgePanel traceId={traceId} />
          )}
        </div>

        {!isJudgeView ? (
          <TraceSidebarRight
            trace={trace}
            isCollapsed={rightCollapsed}
            onToggle={() => setRightCollapsed(!rightCollapsed)}
          />
        ) : null}
      </div>
    </div>
  );
}
