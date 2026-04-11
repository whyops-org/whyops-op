import { Copy } from "lucide-react";

import { InfoBox } from "./info-box";
import type { MasterKey } from "@/stores/projectStore";

interface WorkspaceApiKeyPanelProps {
  copiedKeyId: string | null;
  selectedKey: MasterKey;
  onCopy: (key: MasterKey) => void;
}

export function WorkspaceApiKeyPanel({
  copiedKeyId,
  selectedKey,
  onCopy,
}: WorkspaceApiKeyPanelProps) {
  return (
    <InfoBox variant="warning" title="Store this key now" className="p-5">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed">
          Copy this key now. After you leave onboarding, WhyOps will only show the prefix for this credential.
        </p>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{selectedKey.name}</p>
          <div className="flex flex-col gap-3 rounded-sm border border-border/50 bg-background px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-2 w-2 shrink-0 bg-primary" />
              <code className="block truncate font-mono text-sm text-foreground/90">
                {selectedKey.prefix}...
              </code>
            </div>
            <button
              onClick={() => onCopy(selectedKey)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-sm border border-border/50 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              type="button"
            >
              <Copy className="h-4 w-4" />
              {copiedKeyId === selectedKey.id ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </InfoBox>
  );
}
