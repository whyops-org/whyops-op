"use client";

import { useEffect } from "react";

import { InfoBox } from "@/components/onboarding/info-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MacOSWindowContent, MacOSWindowHeader } from "@/components/ui/macos-window";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/connectionStore";
import { Info } from "lucide-react";

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionModal({ open, onOpenChange }: ConnectionModalProps) {
  const {
    steps,
    logs,
    isTesting,
    isConnected,
    error,
    testConnection,
    reset,
  } = useConnectionStore();

  useEffect(() => {
    if (open && !isTesting && !isConnected) {
      testConnection();
    }
  }, [open, isTesting, isConnected, testConnection]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
    }
    onOpenChange(isOpen);
  };

  // Determine overall status badge
  const getStatusBadge = () => {
    if (error) {
      return (
        <Badge className="h-5 shrink-0 border-destructive/30 bg-destructive/10 px-1.5 text-[10px] text-destructive">
          Failed
        </Badge>
      );
    }
    if (isConnected) {
      return (
        <Badge className="h-5 shrink-0 border-border/70 bg-surface-2/50 px-1.5 text-[10px] text-foreground">
          Connected
        </Badge>
      );
    }
    return (
      <Badge className="h-5 shrink-0 border-border/70 bg-surface-2/40 px-1.5 text-[10px] text-muted-foreground">
        Waiting
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 border-border/60 bg-card p-0">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 pr-14">
          <DialogHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-lg">
                  {error ? "Connection Failed" : isConnected ? "Connection Established" : "Establishing Connection"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm">
                  {error
                    ? "Could not connect to WhyOps cloud"
                    : isConnected
                    ? "Your agent is connected to WhyOps"
                    : "Connecting local agent to WhyOps cloud"}
                </DialogDescription>
              </div>
              {getStatusBadge()}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {step.status === "success" ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-sm border border-border/60 bg-surface-2/40">
                      <CheckIcon className="h-3 w-3 text-foreground" />
                    </div>
                  ) : step.status === "loading" ? (
                    <div className="flex h-5 w-5 items-center justify-center">
                      <Spinner className="h-4 w-4 border-2 text-muted-foreground" />
                    </div>
                  ) : step.status === "error" ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-sm border border-destructive/40 bg-destructive/10">
                      <XIcon className="h-3 w-3 text-destructive" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-sm border border-border/50 bg-surface-2/20" />
                  )}
                </div>

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

          <div className="overflow-hidden rounded-sm border border-border/60 bg-surface-2/40">
            <MacOSWindowHeader title="Connection log" />
            <MacOSWindowContent className="p-4 font-mono text-xs leading-relaxed">
              {logs.length === 0 ? (
                <div className="flex gap-2">
                  <span className="text-foreground/80">▂</span>
                </div>
              ) : (
                <>
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-muted-foreground">[{log.time}]</span>
                      <span className="text-foreground/80">&gt; {log.message}</span>
                      {log.status && (
                        <span
                          className={cn(
                            "ml-auto",
                            log.status === "success" && "text-foreground",
                            log.status === "connected" && "text-foreground",
                            log.status === "error" && "text-destructive"
                          )}
                        >
                          {log.status === "success" && "✓"}
                          {log.status === "connected" && "✓"}
                          {log.status === "error" && "✗"}
                        </span>
                      )}
                    </div>
                  ))}
                  {isTesting && (
                    <div className="mt-1 flex gap-2">
                      <span className="text-foreground/80">▂</span>
                    </div>
                  )}
                </>
              )}
            </MacOSWindowContent>
          </div>

          <InfoBox variant="info" icon={Info} title="">
            Ensure your agent is running and{" "}
            <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-xs text-foreground">
              /agent/init
            </code>{" "}
            has been called in your application entry point.
          </InfoBox>
        </div>

        <DialogFooter className="border-t border-border/50 bg-surface-2/30 px-6 py-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleClose(false)}
            >
              {isConnected ? "Close" : "Cancel Connection"}
            </Button>
            {!isConnected && !error && (
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={isTesting}
              >
                {isTesting ? "Testing..." : "Retry"}
              </Button>
            )}
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

function XIcon({ className }: { className?: string }) {
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
        d="M12 4L4 12M4 4L12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
