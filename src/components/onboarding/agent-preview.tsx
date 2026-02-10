
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Brain, CheckCircle2 } from "lucide-react";

interface AgentPreviewProps {
  direction?: "vertical" | "horizontal";
  className?: string;
}

export function AgentPreview({ direction = "vertical", className }: AgentPreviewProps) {
  const isVertical = direction === "vertical";
  
  return (
    <Card className={cn(
      "relative w-full overflow-hidden bg-transparent border-none shadow-none",
      isVertical ? "min-h-125 h-[60vh]" : "min-h-100 h-[50vh]",
      className
    )}>
       {/* Container with dark background equivalent to ProviderCard */}
       <div className="absolute inset-0 bg-card border border-border/30 rounded-3xl overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(46,230,193,0.05),transparent_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(46,230,193,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(46,230,193,0.03)_1px,transparent_1px)] bg-size-[2vw_2vw] mask-[radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

          <div className="relative flex h-full flex-col p-[2vw]">
            {/* Window Controls */}
            <div className="flex items-center gap-[0.5vw] mb-[2dvh]">
              <span className="h-[1vh] w-[1vh] rounded-full bg-destructive" />
              <span className="h-[1vh] w-[1vh] rounded-full bg-yellow-500" />
              <span className="h-[1vh] w-[1vh] rounded-full bg-primary" />
            </div>

            {/* Central Visualization */}
            <div className="flex-1 relative">
               {/* Center Node */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative flex items-center justify-center">
                     <div className="absolute w-[6vw] h-[6vw] bg-primary/10 rounded-full animate-pulse blur-xl"></div>
                     <div className="relative w-[4vw] h-[4vw] bg-muted border border-primary/30 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <Brain className="w-[2vw] h-[2vw] text-primary" />
                     </div>
                     
                     {/* Connection Lines (Simulated) */}
                     <div className="absolute w-px h-[10dvh] bg-linear-to-t from-primary/20 to-transparent bottom-full left-1/2"></div>
                     <div className="absolute w-px h-[10dvh] bg-linear-to-b from-primary/20 to-transparent top-full left-1/2"></div>
                     <div className="absolute h-px w-[10vw] bg-linear-to-l from-primary/20 to-transparent right-full top-1/2"></div>
                     <div className="absolute h-px w-[10vw] bg-linear-to-r from-primary/20 to-transparent left-full top-1/2"></div>
                  </div>
               </div>

               {/* Floating Particles */}
               <div className="absolute top-1/4 left-1/4 w-[0.4vw] h-[0.4vw] bg-primary/40 rounded-full animate-bounce duration-3000"></div>
               <div className="absolute bottom-1/3 right-1/4 w-[0.4vw] h-[0.4vw] bg-primary/30 rounded-full animate-bounce duration-4000"></div>
               <div className="absolute top-1/3 right-1/3 w-[0.25vw] h-[0.25vw] bg-primary/50 rounded-full"></div>

            </div>

            {/* Bottom Status Bar */}
            <div className="mt-auto">
              <div className="rounded-xl border border-border/20 bg-muted/80 p-4 flex items-center justify-between shadow-lg backdrop-blur-sm">
                 <div className="flex items-center gap-3">
                   <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                   <div className="h-1.5 w-24 rounded-full bg-primary/20"></div>
                   <div className="h-1.5 w-12 rounded-full bg-primary/10"></div>
                 </div>
                 <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                   <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                 </div>
              </div>
            </div>
          </div>
       </div>
    </Card>
  );
}
