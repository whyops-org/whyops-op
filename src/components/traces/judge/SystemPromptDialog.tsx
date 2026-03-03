import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SystemPromptDialogProps {
  prompt: string;
  buttonLabel?: string;
  title?: string;
  description?: string;
}

export function SystemPromptDialog({
  prompt,
  buttonLabel = "View Full Prompt",
  title = "System Prompt",
  description = "Full original prompt captured for this trace.",
}: SystemPromptDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-full">
          {buttonLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-border/60 bg-surface-2/30 p-3">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {prompt}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
