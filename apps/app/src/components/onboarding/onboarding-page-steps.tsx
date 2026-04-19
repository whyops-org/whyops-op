import { Activity, ChevronRight, Key, Link as LinkIcon } from "lucide-react";
import * as React from "react";

import { AgentPreview } from "@/components/onboarding/agent-preview";
import { CompleteStep } from "@/components/onboarding/complete-step";
import { WorkspaceCard } from "@/components/onboarding/workspace-card";
import { Button } from "@/components/ui/button";
import type { AppConfig } from "@/stores/configStore";

type OnboardingStepDefinition = {
  id: string;
  label: string;
};

type OnboardingPageStep = {
  id: string;
  title: React.ReactNode;
  subtitle: string;
  textAlign?: "center";
  content: React.ReactNode | null;
  preview: React.ReactNode;
};

type BuildOnboardingStepsOptions = {
  config: AppConfig | null;
  userName: string;
  isFinishing: boolean;
  hasProvider: boolean;
  onFinish: () => void;
  onStartSetup: () => void;
  onBackToWelcome: () => void;
  onContinueFromWorkspace: () => void;
  onBackToWorkspace: () => void;
};

const iconMap: Record<string, typeof LinkIcon> = {
  Link: LinkIcon,
  Key,
  Activity,
};

const defaultChecklist = [
  { id: "create-workspace", icon: "Key", text: "Create your workspace and API key" },
  { id: "choose-ingestion", icon: "Link", text: "Choose manual events or the proxy" },
  { id: "capture-trace", icon: "Activity", text: "Capture your first trace" },
];

const defaultSteps: OnboardingStepDefinition[] = [
  { id: "welcome", label: "Welcome" },
  { id: "workspace", label: "Workspace" },
  { id: "complete", label: "Complete" },
];

function WelcomeStepContent({
  checklist,
  onStartSetup,
}: {
  checklist: Array<{ id: string; text: string; icon: typeof LinkIcon }>;
  onStartSetup: () => void;
}) {
  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-center gap-3 text-muted-foreground/80">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border/50 bg-muted text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <span className="font-medium text-foreground">{item.text}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4 pt-4">
        <Button size="lg" className="px-6" onClick={onStartSetup}>
          Start setup
          <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
        <button
          className="px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={onStartSetup}
          type="button"
        >
          Skip ahead
        </button>
      </div>
    </div>
  );
}

function getChecklist(config: AppConfig | null) {
  const configuredChecklist = config?.onboardingChecklist.filter(
    (item) => item.id !== "connect-provider"
  );
  const checklistRaw =
    configuredChecklist && configuredChecklist.length > 0
      ? configuredChecklist
      : defaultChecklist;

  return checklistRaw.map((item) => ({
    ...item,
    icon: iconMap[item.icon] || LinkIcon,
  }));
}

export function getOnboardingStepDefinitions(config: AppConfig | null): OnboardingStepDefinition[] {
  const configuredSteps = config?.onboardingSteps
    .filter((step) => step.id !== "provider")
    .map((step) => ({
      id: step.id,
      label: step.label,
    }));

  return configuredSteps && configuredSteps.length > 0 ? configuredSteps : defaultSteps;
}

export function buildOnboardingSteps({
  config,
  userName,
  isFinishing,
  hasProvider,
  onFinish,
  onStartSetup,
  onBackToWelcome,
  onContinueFromWorkspace,
  onBackToWorkspace,
}: BuildOnboardingStepsOptions): OnboardingPageStep[] {
  const checklist = getChecklist(config);

  return [
    {
      id: "welcome",
      title: (
        <>
          Welcome to WhyOps, <span className="text-primary">{userName}!</span>
        </>
      ),
      subtitle:
        "Create a workspace, optionally add a provider for proxy mode, and start sending your first agent trace.",
      content: <WelcomeStepContent checklist={checklist} onStartSetup={onStartSetup} />,
      preview: <AgentPreview direction="vertical" />,
    },
    {
      id: "workspace",
      title: "Set up your workspace",
      subtitle: "Create an API key to securely connect your AI agents to WhyOps.",
      textAlign: "center",
      content: null,
      preview: (
        <WorkspaceCard onBack={onBackToWelcome} onContinue={onContinueFromWorkspace} />
      ),
    },
    {
      id: "complete",
      title: "Connect your AI Agent",
      subtitle:
        "Use manual events right away, or add a provider later if you want to route calls through the WhyOps proxy.",
      textAlign: "center",
      content: null,
      preview: (
        <CompleteStep
          hasProvider={hasProvider}
          isFinishing={isFinishing}
          onBack={onBackToWorkspace}
          onFinish={onFinish}
        />
      ),
    },
  ];
}
