"use client";

import { ConnectionModal } from "@/components/dashboard/connection-modal";
import { CodeBlock } from "@/components/onboarding/code-block";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { goToDocumentation } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useConfigStore } from "@/stores/configStore";
import * as React from "react";

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement>;

export function EmptyState({ className, ...props }: EmptyStateProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { config, fetchConfig } = useConfigStore();
  const { onboardingProgress, fetchOnboardingProgress } = useAuthStore();

  const isOnboardingComplete = onboardingProgress?.onboardingComplete ?? false;
  const onboardingMessage = `Complete onboarding first to get your API endpoint\n\nVisit /onboarding to set up your provider and project.`;
  const curlCommand = [
    "curl -X POST " + (config?.analyseBaseUrl || "https://api.whyops.ai") + "/events \\",
    "  -H 'Authorization: Bearer YOUR_API_KEY' \\",
    "  -H 'Content-Type: application/json' \\",
    "  -d '{\"eventType\": \"user_message\", \"agent\": \"test_agent\"}'",
  ].join("\n");

  // Fetch config and onboarding progress on mount
  React.useEffect(() => {
    fetchConfig();
    fetchOnboardingProgress();
  }, [fetchConfig, fetchOnboardingProgress]);

  return (
    <>
      <div
        className={cn(
          "flex flex-col items-center justify-center px-8 py-16",
          className
        )}
        {...props}
      >
        <h1 className="mb-3 text-2xl font-semibold text-foreground">
          No agents detected yet
        </h1>

        <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
          Connect a provider or send a test event to start populating the dashboard with real traces.
        </p>

        <div className="mb-12 flex items-center gap-3">
          <Button onClick={goToDocumentation} variant="primary" size="md">
            <BookIcon className="h-4 w-4" />
            View Integration Guide
          </Button>
          <Button variant="outline" size="md" onClick={() => setIsModalOpen(true)}>
            <TestIcon className="h-4 w-4" />
            Test Connection
          </Button>
        </div>

        {!isOnboardingComplete ? (
          <Card className="w-full max-w-md">
            <div className="px-5 py-5">
              <CodeBlock className="rounded-none border-none" code={onboardingMessage} language="text" />
            </div>
          </Card>
        ) : (
          <Card className="w-full max-w-md">
            <div className="px-5 py-5">
              <CodeBlock code={curlCommand} className="rounded-none border-none" language="bash" />
            </div>
          </Card>
        )}
      </div>

      <ConnectionModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M2 3C2 2.44772 2.44772 2 3 2H7.5C8.88071 2 10 3.11929 10 4.5V13.5C10 12.6716 9.32843 12 8.5 12H2V3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 3C14 2.44772 13.5523 2 13 2H8.5C7.11929 2 6 3.11929 6 4.5V13.5C6 12.6716 6.67157 12 7.5 12H14V3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TestIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M14 8C14 11.3137 11.3137 14 8 14M14 8C14 4.68629 11.3137 2 8 2M14 8H2M8 14C4.68629 14 2 11.3137 2 8M8 14C9.5 12 10 10 10 8C10 6 9.5 4 8 2M8 14C6.5 12 6 10 6 8C6 6 6.5 4 8 2M2 8C2 4.68629 4.68629 2 8 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
