import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepNavigationProps {
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  backLabel?: string;
  disabled?: boolean;
  showBack?: boolean;
}

export function StepNavigation({
  onBack,
  onContinue,
  continueLabel = "Continue",
  backLabel = "Back",
  disabled = false,
  showBack = true
}: StepNavigationProps) {
  return (
    <div className="flex items-center justify-between">
      {showBack ? (
        <button
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </button>
      ) : <div />}
      
      <Button
        size="lg"
        className="h-11 px-5 text-sm"
        onClick={onContinue}
        disabled={disabled}
        type="button"
      >
        {continueLabel}
        <ChevronRight className="h-5 w-5 ml-1" />
      </Button>
    </div>
  );
}
