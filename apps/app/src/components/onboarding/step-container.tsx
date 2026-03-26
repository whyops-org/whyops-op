import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StepContainerProps {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
}

export function StepContainer({ children, className, maxHeight = "70vh" }: StepContainerProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-sm border border-border/50 bg-card",
        className
      )}
      style={{ maxHeight }}
    >
      <div className="flex-1 space-y-7 overflow-y-auto p-6 pb-28 lg:p-8 lg:pb-32 scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
        {children}
      </div>
    </div>
  );
}
