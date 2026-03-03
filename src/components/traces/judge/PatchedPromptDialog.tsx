import { FilePenLine, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface UnappliedPatch {
  index: number;
  location?: string;
  reason: "missing_original" | "not_found_in_source";
  originalPreview: string;
}

interface PatchedPromptDialogProps {
  patchedText: string;
  appliedCount: number;
  totalCount: number;
  unappliedPatches?: UnappliedPatch[];
  buttonLabel?: string;
  title?: string;
  description?: string;
}

export function PatchedPromptDialog({
  patchedText,
  appliedCount,
  totalCount,
  unappliedPatches = [],
  buttonLabel = "View Full Patched Context",
  title = "Patched Context",
  description = "Full preview after applying all suggested patches for this finding.",
}: PatchedPromptDialogProps) {
  const unappliedCount = Math.max(totalCount - appliedCount, 0);
  const shouldShowUnappliedInfo = unappliedCount > 0;

  const getReasonLabel = (reason: UnappliedPatch["reason"]) => {
    if (reason === "missing_original") {
      return "Original missing in patch";
    }
    return "Original text not found";
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-full justify-center">
          {buttonLabel}
          <FilePenLine className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[80vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{title}</DialogTitle>
            <Badge className="text-[10px]">
              {appliedCount}/{totalCount} patches applied
            </Badge>
            {shouldShowUnappliedInfo ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-warning/40 bg-warning/10 text-warning transition-colors hover:bg-warning/20"
                    aria-label="Show unapplied patch details"
                    title="Show unapplied patch details"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[28rem] space-y-2 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Some patches were not applied
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {unappliedCount} of {totalCount} patch{unappliedCount === 1 ? "" : "es"} could
                      not be applied to this source.
                    </p>
                  </div>

                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {unappliedPatches.length > 0 ? (
                      unappliedPatches.map((patch) => (
                        <div
                          key={`${patch.index}-${patch.location || "unknown"}`}
                          className="rounded-sm border border-border/60 bg-surface-2/35 p-2"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground">
                              Patch {patch.index + 1}
                              {patch.location ? ` • ${patch.location}` : ""}
                            </span>
                            <Badge className="text-[10px]">
                              {getReasonLabel(patch.reason)}
                            </Badge>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {patch.originalPreview}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-sm border border-border/60 bg-surface-2/35 p-2 text-xs text-muted-foreground">
                        Patch details are unavailable, but some patches did not match this source.
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-border/60 bg-surface-2/30 p-3">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {patchedText || "No source content available."}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
