"use client";

import { Play, RefreshCw, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ReplayVariantConfig } from "@/stores/replayStore";
import type { JudgeFinding } from "@/stores/judgeStore";

interface ReplayControlsProps {
  isRunning: boolean;
  systemPrompt: string;
  patches: JudgeFinding[];
  onRun: (config: ReplayVariantConfig) => void;
  historyAction?: React.ReactNode;
}

function extractPatchesFromFindings(findings: JudgeFinding[]): {
  systemPromptPatch: string | undefined;
  toolPatches: Record<string, string>;
  summary: string;
} {
  let systemPromptPatch: string | undefined;
  const toolPatches: Record<string, string> = {};
  const summaryParts: string[] = [];

  for (const f of findings) {
    for (const p of f.recommendation?.patches ?? []) {
      if (!p.suggested) continue;
      if (f.dimension === "prompt_quality" || p.location?.includes("system_prompt")) {
        // Use the last/best system prompt patch
        systemPromptPatch = p.suggested;
        summaryParts.push("system prompt");
      } else if (f.dimension === "tool_description" && p.location) {
        toolPatches[p.location] = p.suggested;
        summaryParts.push(`tool:${p.location}`);
      }
    }
  }

  return {
    systemPromptPatch,
    toolPatches,
    summary: summaryParts.length > 0 ? `Patches: ${[...new Set(summaryParts)].join(", ")}` : "No patches",
  };
}

export function ReplayControls({
  isRunning,
  systemPrompt,
  patches,
  onRun,
  historyAction,
}: ReplayControlsProps) {
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);

  const { systemPromptPatch, toolPatches, summary } = extractPatchesFromFindings(patches);
  const hasPatchSuggestions = Boolean(systemPromptPatch) || Object.keys(toolPatches).length > 0;

  const handleRun = () => {
    const config: ReplayVariantConfig = {
      systemPrompt: useCustomPrompt
        ? customPrompt || systemPrompt
        : systemPromptPatch ?? systemPrompt,
      toolDescriptions: Object.keys(toolPatches).length > 0 ? toolPatches : undefined,
      patchSummary: useCustomPrompt ? "Custom system prompt" : summary,
    };
    onRun(config);
    setOpen(false);
  };

  return (
    <section className="rounded-sm border border-border/60 bg-surface-2/20 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Trace Replay
          </p>
          <p className="text-lg font-semibold text-foreground">
            Re-run this trace with fixes applied.
          </p>
          <p className="text-sm text-muted-foreground">
            Applies judge patches to your system prompt and tool descriptions, then re-runs only
            the LLM steps using the original recorded tool outputs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          {historyAction}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="primary" disabled={isRunning} className="h-10 gap-2 px-4">
                <Settings2 className="h-4 w-4" />
                Configure & Replay
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] max-w-2xl border-border/60 bg-card p-0">
              <DialogHeader className="border-b border-border/55 px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Configure Replay
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Choose how to modify the trace before replaying it.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 overflow-y-auto px-5 py-4">
                {/* Source selection */}
                <section className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Patch source</p>
                  <div className="flex flex-col gap-2">
                    <SourceOption
                      active={!useCustomPrompt}
                      onClick={() => setUseCustomPrompt(false)}
                      title={hasPatchSuggestions ? "Use judge patches" : "Original (no judge patches found)"}
                      description={hasPatchSuggestions ? summary : "Run judge first to generate patches"}
                      disabled={!hasPatchSuggestions}
                    />
                    <SourceOption
                      active={useCustomPrompt}
                      onClick={() => setUseCustomPrompt(true)}
                      title="Custom system prompt"
                      description="Write your own system prompt override"
                    />
                  </div>
                </section>

                {/* Custom prompt editor */}
                {useCustomPrompt && (
                  <section className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      System prompt override
                    </p>
                    <textarea
                      className="h-48 w-full resize-none rounded-sm border border-border/60 bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/50"
                      placeholder="Paste or write a new system prompt…"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      defaultValue={systemPrompt}
                    />
                  </section>
                )}

                {/* Info box */}
                <div className="rounded-sm border border-border/40 bg-surface-2/30 px-4 py-3 text-sm text-muted-foreground">
                  Tool calls from the original trace will be reused verbatim — no external calls are made.
                  Only LLM responses are re-generated.
                </div>
              </div>

              <DialogFooter className="border-t border-border/55 bg-surface-2/25 px-5 py-4">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="h-9 px-4">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleRun}
                  disabled={isRunning || (useCustomPrompt && !customPrompt.trim())}
                  loading={isRunning}
                  className="h-9 gap-2 px-4"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Replay
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}

interface SourceOptionProps {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  disabled?: boolean;
}

function SourceOption({ active, onClick, title, description, disabled }: SourceOptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-sm border px-4 py-3 text-left transition-colors",
        active
          ? "border-primary/45 bg-primary/10"
          : "border-border/60 bg-surface-2/20 hover:border-border",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2",
          active ? "border-primary bg-primary" : "border-border bg-transparent"
        )}
      />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
