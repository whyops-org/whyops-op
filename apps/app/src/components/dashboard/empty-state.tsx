"use client";

import * as React from "react";
import { BookOpen, FlaskConical } from "lucide-react";

import { ConnectionModal } from "@/components/dashboard/connection-modal";
import { CodeBlock } from "@/components/onboarding/code-block";
import { Button } from "@/components/ui/button";
import { goToDocumentation } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useConfigStore } from "@/stores/configStore";

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement>;

function buildCurlCommand(analyseBaseUrl?: string) {
  const baseUrl = (analyseBaseUrl || "https://a.whyops.com/api").replace(/\/$/, "");
  return [
    `curl -X POST ${baseUrl}/events/ingest \\`,
    `  -H "Authorization: Bearer YOUR_API_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{`,
    `    "traceId": "session-123",`,
    `    "agentName": "customer-support-agent",`,
    `    "eventType": "user_message",`,
    `    "content": {`,
    `      "messages": [{ "role": "user", "content": "Where is order 123?" }]`,
    `    }`,
    `  }'`,
  ].join("\n");
}

export function EmptyState({ className, ...props }: EmptyStateProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { config, fetchConfig } = useConfigStore();
  const { onboardingProgress, fetchOnboardingProgress } = useAuthStore();

  React.useEffect(() => {
    fetchConfig();
    fetchOnboardingProgress();
  }, [fetchConfig, fetchOnboardingProgress]);

  const isOnboardingComplete = onboardingProgress?.onboardingComplete ?? false;
  const snippet = isOnboardingComplete
    ? buildCurlCommand(config?.analyseBaseUrl)
    : "Finish onboarding to generate a workspace and API key, then send your first test event from the integration guide.";

  return (
    <>
      <section
        className={cn(
          "flex h-full min-h-0 items-center justify-center px-6 py-8 lg:px-8",
          className
        )}
        {...props}
      >
        <div className="flex w-full max-w-4xl flex-col items-center gap-8">
          <div className="max-w-2xl space-y-3 text-center">
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">No agents detected yet</h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Connect a provider or send a single test event to start populating the agents dashboard
              with real traces.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={goToDocumentation} variant="primary" size="md">
              <BookOpen className="h-4 w-4" />
              View Integration Guide
            </Button>
            <Button variant="outline" size="md" onClick={() => setIsModalOpen(true)}>
              <FlaskConical className="h-4 w-4" />
              Test Connection
            </Button>
          </div>

          <div className="w-full max-w-3xl rounded-sm border border-border/40 bg-card">
            <div className="border-b border-border/40 px-5 py-3">
              <p className="text-sm font-medium text-foreground">
                {isOnboardingComplete ? "Quick ingest test" : "Next step"}
              </p>
            </div>
            <div className="px-5 py-5">
              <CodeBlock
                code={snippet}
                language={isOnboardingComplete ? "bash" : "text"}
                className="border-none bg-transparent"
              />
            </div>
          </div>
        </div>
      </section>

      <ConnectionModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}
