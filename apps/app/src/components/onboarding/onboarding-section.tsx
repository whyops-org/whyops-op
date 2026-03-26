import * as React from "react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface OnboardingSectionProps {
  step: string;
  title: string;
  subtitle: string;
  progress: number;
  progressLabel: string;
  children: React.ReactNode;
  aside: React.ReactNode;
  className?: string;
}

export function OnboardingSection({
  step,
  title,
  subtitle,
  progress,
  progressLabel,
  children,
  aside,
  className,
}: OnboardingSectionProps) {
  return (
    <section
      className={cn(
        "grid h-full w-full gap-10 lg:grid-cols-[1.1fr_0.9fr]",
        className
      )}
    >
      <div className="flex flex-col gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span>{step}</span>
            <span>{progressLabel}</span>
          </div>
          <Progress value={progress} />
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {title}
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {subtitle}
          </p>
        </div>
        <div className="space-y-5 text-base leading-relaxed text-muted-foreground">{children}</div>
      </div>
      <div className="flex items-center justify-center lg:justify-end">{aside}</div>
    </section>
  );
}
