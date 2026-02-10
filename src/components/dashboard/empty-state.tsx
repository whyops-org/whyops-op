"use client";

import { ConnectionModal } from "@/components/dashboard/connection-modal";
import { Radar } from "@/components/dashboard/radar";
import { Button } from "@/components/ui/button";
import { MacOSWindow, MacOSWindowContent } from "@/components/ui/macos-window";
import { cn } from "@/lib/utils";
import * as React from "react";

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement>;

export function EmptyState({ className, ...props }: EmptyStateProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <>
      <div
        className={cn(
          "flex flex-col items-center justify-center px-8 py-16",
          className
        )}
        {...props}
      >
        {/* Radar Animation */}
        <div className="mb-12 w-85">
          <Radar />
        </div>

        {/* Heading */}
        <h1 className="mb-3 text-2xl font-semibold text-foreground">
          No agents detected yet
        </h1>

        {/* Description */}
        <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
          Waiting for your first agent trace... Connect your LLM provider or send a
          manual test ping to populate your dashboard.
        </p>

        {/* Action Buttons */}
        <div className="mb-12 flex items-center gap-3">
          <Button variant="primary" size="md">
            <BookIcon className="h-4 w-4" />
            View Integration Guide
          </Button>
          <Button variant="outline" size="md" onClick={() => setIsModalOpen(true)}>
            <TestIcon className="h-4 w-4" />
            Test Connection
          </Button>
        </div>

        {/* Code Block */}
        <MacOSWindow className="w-full max-w-md">
          <MacOSWindowContent className="px-5 py-4">
            <pre className="text-xs leading-relaxed">
              <code>
                <span className="text-primary">$</span>{" "}
                <span className="text-foreground/80">curl -X POST </span>
                <span className="text-accent">
                  https://api.whyops.ai/trace
                </span>
                {" \\"}
                {"\n"}
                <span className="text-foreground/80">  -d </span>
                <span className="text-accent">
                  &apos;&#123;&quot;agent&quot;: &quot;test_ping&quot;, &quot;status&quot;: &quot;ok&quot;&#125;&apos;
                </span>
              </code>
            </pre>
          </MacOSWindowContent>
        </MacOSWindow>
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
