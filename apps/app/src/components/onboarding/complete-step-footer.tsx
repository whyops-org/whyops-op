import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { goToDocumentation } from "@/lib/helper";
import { OnboardingViewportFooter } from "./onboarding-viewport-footer";

interface CompleteStepFooterProps {
  isFinishing?: boolean;
  onBack?: () => void;
  onFinish?: () => void;
}

export function CompleteStepFooter({
  isFinishing,
  onBack,
  onFinish,
}: CompleteStepFooterProps) {
  return (
    <OnboardingViewportFooter>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-4">
            {onBack ? (
              <button
                onClick={onBack}
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                type="button"
              >
                <span className="inline-flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </span>
              </button>
            ) : null}
            <button
              onClick={() => goToDocumentation()}
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              type="button"
            >
              View Documentation
            </button>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-2 w-2 bg-warning" />
            <span>Waiting for first event...</span>
          </div>
        </div>
        <Button size="lg" className="min-w-[180px]" onClick={onFinish} disabled={isFinishing}>
          {isFinishing ? (
            "Finishing..."
          ) : (
            <>
              Go to Dashboard
              <ChevronRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </OnboardingViewportFooter>
  );
}
