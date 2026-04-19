import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, DollarSign, ChevronDown, ChevronRight, Copy } from "lucide-react";

export function StepHeader({ 
  step, 
  isExpanded, 
  onClick 
}: { 
  step: { title: string; tag: string; duration: string; cost?: string }; 
  isExpanded: boolean; 
  onClick: () => void; 
}) {
  return (
      <div
        className={cn(
        "cursor-pointer p-4 transition-colors hover:bg-surface-2/30 flex items-center justify-between",
        isExpanded && "border-b border-border/30 bg-surface-2/10"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          {step.title}
        </h3>
        <Badge
          className={cn(
            "rounded-sm px-2 py-1 text-xs font-medium border",
            step.tag === "INPUT" && "border-border/60 bg-surface-2/60 text-foreground",
            step.tag === "LLM" && "border-primary/25 bg-primary/10 text-primary",
            step.tag === "LOGIC" && "border-warning/25 bg-warning/10 text-warning",
            step.tag === "TOOL" && "border-primary/25 bg-primary/10 text-primary",
            step.tag === "OUTPUT" && "border-border/60 bg-surface-2/60 text-foreground"
          )}
        >
          {step.tag}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {step.duration !== "--" && (
          <Badge
            className="h-7 gap-1.5 border-border/50 bg-surface-2 px-2.5 font-mono text-xs text-muted-foreground hover:bg-surface-3"
          >
            <Clock className="h-3 w-3 opacity-70" />
            {step.duration}
          </Badge>
        )}
        {step.cost && (
          <Badge
            className="h-7 gap-1.5 border-border/50 bg-surface-2 px-2.5 font-mono text-xs text-muted-foreground hover:bg-surface-3"
          >
            <DollarSign className="h-3 w-3 opacity-70" />
            {step.cost}
          </Badge>
        )}
        <div className="text-muted-foreground/50 transition-transform duration-200">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StepContent({ step }: { step: any }) {
  if (step.content.type === "json") {
    return (
      <div className="space-y-3 bg-surface-2/5 p-5">
        <div className="flex items-center justify-between px-1 text-sm font-medium text-muted-foreground">
          <span>{step.content.label || "Payload"}</span>
          <button className="flex items-center gap-1 hover:text-primary transition-colors focus:outline-hidden">
            <Copy className="h-3 w-3" />
            Copy JSON
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border/40 bg-background p-4 font-mono text-sm text-muted-foreground shadow-sm">
          <pre>{JSON.stringify(step.content.data, null, 2)}</pre>
        </div>
      </div>
    );
  }

  if (step.content.type === "text") {
    return (
      <div className="bg-surface-2/5 p-5">
        <div className="rounded-md border border-border/40 bg-background p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground/80 shadow-sm">
          {step.content.text}
        </div>
      </div>
    );
  }

  if (step.content.type === "tool-execution") {
    return (
      <div className="space-y-4 bg-surface-2/5 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="px-1 text-sm font-medium text-muted-foreground">
              Arguments
            </span>
            <div className="h-36 overflow-x-auto rounded-sm border border-border/40 bg-background p-4 font-mono text-sm text-foreground shadow-none scrollbar-thin">
              <pre>{JSON.stringify(step.content.arguments, null, 2)}</pre>
            </div>
          </div>
          <div className="space-y-2">
            <span className="px-1 text-sm font-medium text-muted-foreground">
              Result
            </span>
            <div className="h-36 overflow-x-auto rounded-sm border border-border/40 bg-background p-4 font-mono text-sm text-foreground shadow-none scrollbar-thin">
              <pre>{JSON.stringify(step.content.result, null, 2)}</pre>
            </div>
          </div>
        </div>

        {step.content.latencyContribution && (
          <div className="pt-4 border-t border-border/30">
            <div className="mb-2 flex items-center justify-between px-1 text-sm text-muted-foreground">
              <span>Latency Contribution</span>
              <span className="font-medium text-foreground">{step.content.latencyContribution}% of total</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-surface-2">
              <div
                className="h-full rounded-sm bg-primary/80 transition-all duration-500 ease-out"
                style={{ width: `${step.content.latencyContribution}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
  
  return null;
}
