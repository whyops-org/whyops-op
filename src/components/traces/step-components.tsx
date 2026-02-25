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
        "flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-surface-2/30",
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
            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
            step.tag === "INPUT" && "bg-blue-500/10 text-blue-500 border-blue-500/20",
            step.tag === "LLM" && "bg-purple-500/10 text-purple-500 border-purple-500/20",
            step.tag === "LOGIC" && "bg-orange-500/10 text-orange-500 border-orange-500/20",
            step.tag === "TOOL" && "bg-teal-500/10 text-teal-500 border-teal-500/20",
            step.tag === "OUTPUT" && "bg-green-500/10 text-green-500 border-green-500/20"
          )}
        >
          {step.tag}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {step.duration !== "--" && (
          <Badge
            className="gap-1.5 bg-surface-2 text-muted-foreground hover:bg-surface-3 font-mono text-[10px] border-border/50 px-2 h-6"
          >
            <Clock className="h-3 w-3 opacity-70" />
            {step.duration}
          </Badge>
        )}
        {step.cost && (
          <Badge
            className="gap-1.5 bg-surface-2 text-muted-foreground hover:bg-surface-3 font-mono text-[10px] border-border/50 px-2 h-6"
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
      <div className="p-4 space-y-2 bg-surface-2/5">
        <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold px-1">
          <span>{step.content.label || "Payload"}</span>
          <button className="flex items-center gap-1 hover:text-primary transition-colors focus:outline-hidden">
            <Copy className="h-3 w-3" />
            Copy JSON
          </button>
        </div>
        <div className="rounded-md border border-border/40 bg-background p-3 font-mono text-xs text-muted-foreground overflow-x-auto shadow-sm">
          <pre>{JSON.stringify(step.content.data, null, 2)}</pre>
        </div>
      </div>
    );
  }

  if (step.content.type === "text") {
    return (
      <div className="p-4 bg-surface-2/5">
        <div className="font-mono text-xs text-foreground/80 bg-background p-4 rounded-md border border-border/40 shadow-sm leading-relaxed whitespace-pre-wrap">
          {step.content.text}
        </div>
      </div>
    );
  }

  if (step.content.type === "tool-execution") {
    return (
      <div className="p-4 bg-surface-2/5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-1">
              Arguments
            </span>
            <div className="rounded-md border border-border/40 bg-background p-3 font-mono text-xs text-green-500/90 overflow-x-auto h-32 scrollbar-thin shadow-sm">
              <pre>{JSON.stringify(step.content.arguments, null, 2)}</pre>
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-1">
              Result
            </span>
            <div className="rounded-md border border-border/40 bg-background p-3 font-mono text-xs text-blue-500/90 overflow-x-auto h-32 scrollbar-thin shadow-sm">
              <pre>{JSON.stringify(step.content.result, null, 2)}</pre>
            </div>
          </div>
        </div>

        {step.content.latencyContribution && (
          <div className="pt-4 border-t border-border/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
              <span>Latency Contribution</span>
              <span className="font-medium text-foreground">{step.content.latencyContribution}% of total</span>
            </div>
            <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/80 rounded-full transition-all duration-500 ease-out"
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
