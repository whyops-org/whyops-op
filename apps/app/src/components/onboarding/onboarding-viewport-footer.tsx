import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface OnboardingViewportFooterProps {
  children: ReactNode;
  className?: string;
}

export function OnboardingViewportFooter({
  children,
  className,
}: OnboardingViewportFooterProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-full">
        <div
          className={cn(
            "mx-auto w-full border border-border/60 bg-card/95 px-6 py-4 backdrop-blur-sm lg:px-7",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
