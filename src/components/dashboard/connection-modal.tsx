"use client";

import { InfoBox } from "@/components/onboarding/info-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
} from "@/components/ui/dialog";
import { MacOSWindowContent, MacOSWindowHeader } from "@/components/ui/macos-window";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import * as React from "react";

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ConnectionStep = {
  id: string;
  label: string;
  description: string;
  status: "success" | "loading" | "pending";
};

export function ConnectionModal({ open, onOpenChange }: ConnectionModalProps) {
  const steps: ConnectionStep[] = [
    {
      id: "verify-key",
      label: "Verify API Key Integrity",
      description: "Validated key ending in ...8xd2",
      status: "success",
    },
    {
      id: "ping-endpoint",
      label: "Ping Ingestion Endpoint",
      description: "Latency: 24ms • Region: us-east-1",
      status: "success",
    },
    {
      id: "wait-trace",
      label: "Waiting for Trace Event",
      description: "Listening for incoming data streams...",
      status: "loading",
    },
  ];

  const [logs] = React.useState([
    { time: "10:00:01", message: "Verifying API key integrity...", status: "Success" },
    { time: "10:00:02", message: "Pinging Ingestion Endpoint...", status: "Connected" },
    { time: "10:00:04", message: "Listening for incoming trace events..." },
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/50 bg-card p-0">
        <div className="space-y-6 p-6 pr-14">
          {/* Header */}
          <DialogHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Establishing Connection
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connecting local agent to WhyOps cloud
                </p>
              </div>
              <Badge className="shrink-0 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                ⏳ WAITING
              </Badge>
            </div>
          </DialogHeader>

          {/* Connection Steps */}
          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                {/* Status Icon */}
                <div className="mt-0.5">
                  {step.status === "success" ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
                      <CheckIcon className="h-3 w-3 text-primary" />
                    </div>
                  ) : step.status === "loading" ? (
                    <div className="flex h-5 w-5 items-center justify-center">
                      <LoadingSpinner className="h-5 w-5 text-yellow-500" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted" />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Terminal Log */}
          <div className="overflow-hidden rounded-xl border border-border/50 bg-[oklch(0.15_0.02_180)]">
            <MacOSWindowHeader title="CONNECTION_LOG" />
            <MacOSWindowContent className="p-4 font-mono text-xs leading-relaxed">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-primary">[{log.time}]</span>
                  <span className="text-foreground/80">&gt; {log.message}</span>
                  {log.status && (
                    <span
                      className={cn(
                        "ml-auto",
                        log.status === "Success" && "text-primary",
                        log.status === "Connected" && "text-primary"
                      )}
                    >
                      {log.status}
                    </span>
                  )}
                </div>
              ))}
              <div className="mt-1 flex gap-2">
                <span className="text-foreground/80">▂</span>
              </div>
            </MacOSWindowContent>
          </div>

          {/* Info Message */}
          <InfoBox variant="info" icon={Info} title="">
            Ensure your agent is running and{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-primary">
              WhyOps.init()
            </code>{" "}
            has been called in your application entry point.
          </InfoBox>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border/50 bg-surface-2/50 px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Cancel Connection
            </Button>
            <Button variant="outline" size="md">
              <DocumentIcon className="h-4 w-4" />
              View SDK Docs
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
        d="M13 4L6 11L3 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
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
        d="M4 2.5H9.5L12 5V13.5H4V2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9.5 2.5V5H12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 7.5H10M6 9.5H10M6 11.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
