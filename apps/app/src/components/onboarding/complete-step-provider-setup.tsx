import { Link2 } from "lucide-react";
import { useState } from "react";

import { ProviderForm } from "@/components/providers/provider-form";
import { Button } from "@/components/ui/button";
import { InfoBox } from "./info-box";

interface CompleteStepProviderSetupProps {
  onProviderAdded: () => void;
  onRetry?: () => void;
  providerError?: string | null;
}

export function CompleteStepProviderSetup({
  onProviderAdded,
  onRetry,
  providerError,
}: CompleteStepProviderSetupProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      {providerError ? (
        <InfoBox variant="warning" icon={Link2} title="Couldn’t load providers">
          <div className="space-y-3">
            <p>{providerError}</p>
            {onRetry ? (
              <Button variant="outline" className="w-full" onClick={onRetry}>
                Retry Provider Load
              </Button>
            ) : null}
          </div>
        </InfoBox>
      ) : null}
      <InfoBox variant="info" icon={Link2} title="Want proxy routing instead?">
        Add a provider here if you want WhyOps to proxy your LLM calls. Manual events are still ready
        right away.
      </InfoBox>

      {isOpen ? (
        <ProviderForm
          className="rounded-sm border border-border/50 bg-card p-5"
          onSuccess={() => {
            setIsOpen(false);
            onProviderAdded();
          }}
          showSecurityInfo={false}
        />
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setIsOpen(true)}>
          Add Provider for Proxy Setup
        </Button>
      )}
    </div>
  );
}
