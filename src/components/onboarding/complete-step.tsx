"use client";

import { ArrowRight, Info, Send, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCodeSnippet, type SnippetType } from "@/lib/code-snippets";
import { goToDocumentation } from "@/lib/helper";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useProviderStore } from "@/stores/providerStore";
import { CodeBlock } from "./code-block";
import { InfoBox } from "./info-box";
import { StepContainer } from "./step-container";
import { TabSelector } from "./tab-selector";

interface CompleteStepProps {
  onFinish?: () => void;
  isFinishing?: boolean;
}

export function CompleteStep({ onFinish, isFinishing }: CompleteStepProps) {
  const { config, fetchConfig } = useConfigStore();
  const { masterKeys, currentProject, currentEnvironments } = useProjectStore();
  const { providers } = useProviderStore();

  const [selectedLang, setSelectedLang] = useState<string>("python");
  const [snippetType, setSnippetType] = useState<SnippetType>("proxy");

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Get code snippet data from store
  const snippetData = useMemo(() => {
    const activeKey = masterKeys[0];
    const activeProvider = providers[0];
    return {
      apiKey: activeKey?.key || "YOUR_API_KEY",
      apiKeyPrefix: activeKey?.prefix || "pk_live_",
      projectId: currentProject?.id || "YOUR_PROJECT_ID",
      environmentId: currentEnvironments?.[0]?.id || "YOUR_ENVIRONMENT_ID",
      providerSlug: activeProvider?.slug || "openai",
    };
  }, [masterKeys, currentProject, currentEnvironments, providers]);

  // Get languages from config
  const languages = useMemo(() => config?.sdkLanguages || [], [config?.sdkLanguages]);

  // Get current code snippet based on selected language and type
  const currentSnippet = !config?.proxyBaseUrl || !config?.analyseBaseUrl
    ? null
    : getCodeSnippet(
      selectedLang,
      snippetData,
      {
        proxyBaseUrl: config.proxyBaseUrl,
        analyseBaseUrl: config.analyseBaseUrl,
        authBaseUrl: config.authBaseUrl,
      },
      snippetType
    );

  // Show loading state while config is loading
  if (!config || !currentSnippet) {
    return (
      <StepContainer>
        <div className="flex items-center justify-center p-12">
          <Spinner className="h-8 w-8 border-4 text-primary" />
        </div>
      </StepContainer>
    );
  }

  return (
    <>
      <StepContainer>
        {/* Snippet Type Tabs (Proxy vs Events) */}
        <Tabs value={snippetType} onValueChange={(v: string) => setSnippetType(v as SnippetType)} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="proxy" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Via Proxy
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Manual Events
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Language Tabs */}
        <TabSelector
          tabs={languages}
          selectedTab={selectedLang}
          onTabChange={(tabId) => setSelectedLang(tabId as string)}
        />

        {/* Content */}
        <div className="space-y-6">
          <div className="space-y-3">
            {/* File label with badge */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                {currentSnippet.filename}
              </span>
              <Badge className="bg-primary/10 border-primary/30 text-primary">
                {snippetData.apiKeyPrefix}...
              </Badge>
            </div>

            {/* Code block with syntax highlighting */}
            <CodeBlock code={currentSnippet.code} language={selectedLang} />

            {/* Info box based on snippet type */}
            {snippetType === "proxy" ? (
              <InfoBox variant="info" icon={Info} title="">
                <p className="text-sm">
                  Use the proxy to automatically track all LLM calls. Just add the{" "}
                  <code className="rounded bg-muted/50 font-mono text-xs">X-Agent-Name</code>{" "}
                  header to your requests. The proxy automatically sends analytics events.
                </p>
              </InfoBox>
            ) : (
              <InfoBox variant="info" icon={Info} title="">
                <p className="text-sm">
                  Send events manually to WhyOps using the REST API. The{" "}
                  <code className="rounded bg-muted/50 font-mono text-xs">eventType</code>{" "}
                  can be:{" "}
                  <code className="rounded bg-muted/50 font-mono text-xs">user_message</code>,{" "}
                  <code className="rounded bg-muted/50 font-mono text-xs">llm_response</code>,{" "}
                  <code className="rounded bg-muted/50 font-mono text-xs">tool_call</code>, or{" "}
                  <code className="rounded bg-muted/50 font-mono text-xs">error</code>.
                </p>
              </InfoBox>
            )}
          </div>
        </div>
      </StepContainer>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 px-12 py-4 z-50">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <button
            onClick={() => goToDocumentation()}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            View Documentation
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">
                Waiting for first event...
              </span>
            </div>

            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              onClick={onFinish}
              disabled={isFinishing}
            >
              {isFinishing ? (
                "Finishing..."
              ) : (
                <>
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
