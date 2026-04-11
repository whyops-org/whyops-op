
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, FileText, Radio, Shield } from "lucide-react";

interface AgentPreviewProps {
  direction?: "vertical" | "horizontal";
  className?: string;
}

export function AgentPreview({ direction = "vertical", className }: AgentPreviewProps) {
  const isVertical = direction === "vertical";

  return (
    <Card
      className={cn(
        "h-full w-full border-border/50 p-0 bg-card",
        isVertical ? "min-h-0" : "min-h-[360px]",
        className
      )}
    >
      <div className="flex h-full p-6 flex-col">
        <div className="border-b border-border/50 pb-4">
          <p className="text-sm font-medium text-foreground">What happens after setup</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            WhyOps starts collecting traces, request metadata, and provider activity as soon as your agent sends its first event.
          </p>
        </div>

        <div className="grid flex-1 gap-2 py-4">
          {[
            {
              icon: Radio,
              title: "Events arrive",
              description: "The SDK forwards trace events and request headers to your workspace.",
            },
            {
              icon: FileText,
              title: "Timelines are built",
              description: "Each request is grouped into a readable trace with durations, tokens, and errors.",
            },
            {
              icon: Shield,
              title: "Settings apply",
              description: "Sampling, provider configuration, and project limits apply to new traffic immediately.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 border border-border/50 bg-surface-2/20 p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center border border-border/60 bg-background text-muted-foreground">
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-4 text-sm">
          <div>
            <p className="font-medium text-foreground">Status</p>
            <p className="text-muted-foreground">Ready for your first trace</p>
          </div>
          <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/10 px-3 py-2 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Connected flow
          </div>
        </div>
      </div>
    </Card>
  );
}
