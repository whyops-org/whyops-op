import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StepContainerProps {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function StepContainer({
  children,
  className,
  bodyClassName,
}: StepContainerProps) {
  return (
    <div className={cn("flex h-full w-full flex-col overflow-hidden rounded-md border border-border/60 bg-card", className)}>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 lg:p-7", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
