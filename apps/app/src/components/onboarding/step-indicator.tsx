import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={cn("sticky top-0 z-10 w-full space-y-4 bg-background py-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2 text-sm transition-colors",
                index === currentStep
                  ? "text-foreground"
                  : index < currentStep
                    ? "text-primary"
                    : "text-muted-foreground/50"
              )}
            >
              {index > 0 && <span className="text-border">•</span>}
              <span className="font-medium">{step.label}</span>
            </div>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {Math.round(progress)}% Complete
        </span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
}
