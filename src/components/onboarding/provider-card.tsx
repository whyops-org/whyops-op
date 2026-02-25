import { useEffect } from "react";

import { ProviderForm } from "@/components/providers/provider-form";
import { ProviderList } from "@/components/providers/provider-list";
import { StepContainer } from "./step-container";
import { StepNavigation } from "./step-navigation";
import { PROVIDER_FORM_COPY } from "@/constants/providers";
import { useProviderStore } from "@/stores/providerStore";
import { useAuthStore } from "@/stores/authStore";

interface ProviderCardProps {
  onBack?: () => void;
  onContinue?: () => void;
}

export function ProviderCard({ onBack, onContinue }: ProviderCardProps) {
  const { fetchOnboardingProgress } = useAuthStore();
  const {
    providers,
    fetchProviders,
  } = useProviderStore();

  useEffect(() => {
    fetchProviders();
	
  }, [fetchProviders]);

  const canContinue = providers.length > 0;

  return (
    <>
      <StepContainer>
        {/* Existing Providers List */}
        {providers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Your Providers
            </h3>
            <ProviderList providers={providers} variant="compact" />
          </div>
        )}

        {/* Add New Provider Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {providers.length > 0
              ? PROVIDER_FORM_COPY.addAnotherTitle
              : PROVIDER_FORM_COPY.sectionTitle}
          </h3>

          <ProviderForm onProviderCreated={fetchOnboardingProgress} showSecurityInfo />
        </div>
      </StepContainer>

      {/* Fixed Navigation */}
      <div className="fixed bottom-0 left-0 right-0 px-12 py-4 z-50">
        <div className="mx-auto max-w-7xl">
          <StepNavigation
            onBack={onBack}
            onContinue={onContinue}
            disabled={!canContinue}
          />
        </div>
      </div>
    </>
  );
}
