import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StepContainer } from "./step-container";

interface OnboardingErrorStateProps {
  actionLabel?: string;
  message: string;
  onRetry: () => void;
  title: string;
}

export function OnboardingErrorState({
  actionLabel = "Try Again",
  message,
  onRetry,
  title,
}: OnboardingErrorStateProps) {
  return (
    <StepContainer>
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-muted text-warning">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
        </div>
        <Button onClick={onRetry} type="button">
          {actionLabel}
        </Button>
      </div>
    </StepContainer>
  );
}
