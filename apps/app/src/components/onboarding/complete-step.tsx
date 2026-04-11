"use client";

import { Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { getCodeSnippet, type SnippetType } from "@/lib/onboarding-code-snippets";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useProviderStore } from "@/stores/providerStore";
import { CompleteStepFooter } from "./complete-step-footer";
import { CompleteStepProviderSelector } from "./complete-step-provider-selector";
import { CompleteStepSnippetPanel } from "./complete-step-snippet-panel";
import { InfoBox } from "./info-box";
import { OnboardingErrorState } from "./onboarding-error-state";
import { StepContainer } from "./step-container";
import { useResolvedApiKey } from "./use-resolved-api-key";

interface CompleteStepProps {
  hasProvider?: boolean;
  onBack?: () => void;
  onFinish?: () => void;
  isFinishing?: boolean;
}

export function CompleteStep({
  hasProvider = false,
  onBack,
  onFinish,
  isFinishing,
}: CompleteStepProps) {
  const { config, fetchConfig, error: configError } = useConfigStore();
  const { masterKeys, currentProject, fetchProjects, isLoading: isProjectLoading, error: projectError } =
    useProjectStore();
  const { providers, fetchProviders, error: providerError, isLoading: isProviderLoading, selectedProvider, setSelectedProvider } =
    useProviderStore();
  const [selectedLang, setSelectedLang] = useState<string>("python");
  const [snippetType, setSnippetType] = useState<SnippetType>(
    hasProvider ? "proxy" : "events"
  );
  const activeProviders = useMemo(() => providers.filter((provider) => provider.isActive), [providers]);
  const activeProvider =
    selectedProvider && activeProviders.some((provider) => provider.id === selectedProvider.id)
      ? selectedProvider
      : activeProviders.length === 1
        ? activeProviders[0]
        : null;
  const canUseProxy = hasProvider || activeProviders.length > 0;
  const activeSnippetType: SnippetType = canUseProxy ? snippetType : "events";
  const activeKey = masterKeys.find((key) => key.key || key.canReveal) || masterKeys[0] || null;
  const { resolvedApiKey, apiKeyError, isResolvingApiKey } = useResolvedApiKey(activeKey);
  const isWaitingForProxyProviders =
    activeSnippetType === "proxy" && hasProvider && isProviderLoading && !activeProviders.length;

  useEffect(() => {
    fetchConfig();
    fetchProjects();
    fetchProviders();
  }, [fetchConfig, fetchProjects, fetchProviders]);

  const snippetData = useMemo(() => {
    return {
      apiKey: resolvedApiKey,
      providerSlug: activeProvider?.slug || "",
    };
  }, [resolvedApiKey, activeProvider?.slug]);

  const languages = useMemo(() => config?.sdkLanguages || [], [config?.sdkLanguages]);
  const activeLanguage = languages.some((language) => language.id === selectedLang)
    ? selectedLang
    : languages[0]?.id || "python";

  const currentSnippet = !config?.proxyBaseUrl || !config?.analyseBaseUrl || !snippetData.apiKey || (activeSnippetType === "proxy" && !snippetData.providerSlug)
    ? null
    : getCodeSnippet(
      activeLanguage,
      snippetData,
      {
        proxyBaseUrl: config.proxyBaseUrl,
        analyseBaseUrl: config.analyseBaseUrl,
      },
      activeSnippetType
    );

  if (!config && configError) {
    return <OnboardingErrorState title="Couldn’t load setup instructions" message={configError} onRetry={fetchConfig} />;
  }
  if (!currentProject && projectError && !isProjectLoading) {
    return <OnboardingErrorState title="Couldn’t load workspace context" message={projectError} onRetry={fetchProjects} />;
  }
  if (!config || isProjectLoading || isResolvingApiKey || isWaitingForProxyProviders) {
    return (
      <StepContainer>
        <div className="flex items-center justify-center p-12">
          <Spinner className="h-8 w-8 border-4 text-primary" />
        </div>
      </StepContainer>
    );
  }

  if (!currentSnippet) {
    const missingProxyProvider = activeSnippetType === "proxy" && !snippetData.providerSlug;
    return (
      <>
        <StepContainer>
          {missingProxyProvider && activeProviders.length > 1 ? (
            <div className="space-y-4">
              <InfoBox variant="warning" icon={Info} title="Choose a provider">
                Select which provider the WhyOps proxy should target for this onboarding snippet.
              </InfoBox>
              <CompleteStepProviderSelector
                providers={activeProviders}
                selectedProviderId={selectedProvider?.id}
                onSelect={(providerId) =>
                  setSelectedProvider(activeProviders.find((provider) => provider.id === providerId) || null)
                }
              />
            </div>
          ) : (
            <InfoBox variant="warning" icon={Info} title="API key needed">
              {missingProxyProvider
                ? "Add or select a provider to generate a proxy snippet."
                : apiKeyError || "Go back to Workspace and generate an API key to load a real snippet."}
            </InfoBox>
          )}
        </StepContainer>
        <CompleteStepFooter isFinishing={isFinishing} onBack={onBack} onFinish={onFinish} />
      </>
    );
  }

  return (
    <>
      <CompleteStepSnippetPanel
        activeProviders={activeProviders}
        canUseProxy={canUseProxy}
        currentSnippet={currentSnippet}
        onProviderAdded={() => setSnippetType("proxy")}
        onProviderRetry={fetchProviders}
        onProviderSelect={(providerId) =>
          setSelectedProvider(activeProviders.find((provider) => provider.id === providerId) || null)
        }
        onSnippetTypeChange={setSnippetType}
        onTabChange={(tabId) => setSelectedLang(tabId as string)}
        providerError={!providers.length ? providerError : null}
        selectedLang={activeLanguage}
        selectedProviderId={selectedProvider?.id}
        snippetType={activeSnippetType}
        tabs={languages}
        tokenPrefix={activeKey?.prefix || "pk_live_"}
      />
      <CompleteStepFooter isFinishing={isFinishing} onBack={onBack} onFinish={onFinish} />
    </>
  );
}
