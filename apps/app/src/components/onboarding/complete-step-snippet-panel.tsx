import { Info, Send, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CodeSnippet, SnippetType } from "@/lib/onboarding-code-snippets";
import type { Provider } from "@/stores/providerStore";
import { CodeBlock } from "./code-block";
import { CompleteStepProviderSelector } from "./complete-step-provider-selector";
import { CompleteStepProviderSetup } from "./complete-step-provider-setup";
import { InfoBox } from "./info-box";
import { StepContainer } from "./step-container";
import { TabSelector } from "./tab-selector";

interface CompleteStepSnippetPanelProps {
  activeProviders: Provider[];
  canUseProxy: boolean;
  currentSnippet: CodeSnippet;
  onProviderAdded: () => void;
  onProviderRetry: () => void;
  onProviderSelect: (providerId: string) => void;
  onSnippetTypeChange: (value: SnippetType) => void;
  onTabChange: (tabId: string) => void;
  providerError?: string | null;
  selectedLang: string;
  selectedProviderId?: string;
  snippetType: SnippetType;
  tabs: Array<{ id: string; label: string; icon: string; installCommand: string }>;
  tokenPrefix: string;
}

export function CompleteStepSnippetPanel({
  activeProviders,
  canUseProxy,
  currentSnippet,
  onProviderAdded,
  onProviderRetry,
  onProviderSelect,
  onSnippetTypeChange,
  onTabChange,
  providerError,
  selectedLang,
  selectedProviderId,
  snippetType,
  tabs,
  tokenPrefix,
}: CompleteStepSnippetPanelProps) {
  return (
    <StepContainer>
      {canUseProxy ? (
        <Tabs value={snippetType} onValueChange={(v: string) => onSnippetTypeChange(v as SnippetType)}>
          <TabsList className="grid h-11 w-full grid-cols-2">
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
      ) : (
        <div className="space-y-4">
          <InfoBox variant="info" icon={Send} title="Manual events are ready">
            Start with direct event ingestion now. Add a provider if you want WhyOps to proxy your
            LLM calls automatically.
          </InfoBox>
          <CompleteStepProviderSetup
            onProviderAdded={onProviderAdded}
            onRetry={onProviderRetry}
            providerError={providerError}
          />
        </div>
      )}

      {snippetType === "proxy" && activeProviders.length > 1 ? (
        <CompleteStepProviderSelector
          providers={activeProviders}
          selectedProviderId={selectedProviderId}
          onSelect={onProviderSelect}
        />
      ) : null}

      <TabSelector tabs={tabs} selectedTab={selectedLang} onTabChange={onTabChange} />

      <div className="grid gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-base font-medium text-muted-foreground">{currentSnippet.filename}</span>
            <Badge className="border-primary/25 bg-primary/10 text-primary">{tokenPrefix}...</Badge>
          </div>
          <CodeBlock code={currentSnippet.code} language={selectedLang} />

          {snippetType === "proxy" ? (
            <InfoBox variant="info" icon={Info} title="">
              <p className="text-sm">
                Initialize the agent once, then reuse{" "}
                <code className="rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-sm">X-Trace-ID</code>{" "}
                and{" "}
                <code className="rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-sm">X-Thread-ID</code>{" "}
                on proxied requests so model calls and runtime events stay on the same thread.
              </p>
            </InfoBox>
          ) : (
            <InfoBox variant="info" icon={Info} title="">
              <p className="text-sm">
                Send events manually to WhyOps using the REST API. The{" "}
                <code className="rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-sm">eventType</code>{" "}
                can be:{" "}
                <code className="rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-sm">user_message</code>,{" "}
                <code className="rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-sm">llm_response</code>,{" "}
                <code className="rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-sm">tool_call_request</code>,{" "}
                <code className="rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-sm">tool_call_response</code>, or{" "}
                <code className="rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-sm">error</code>.
              </p>
            </InfoBox>
          )}
        </div>
      </div>
    </StepContainer>
  );
}
