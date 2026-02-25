"use client";

import {
  Activity,
  ArrowRight,
  Key,
  Link as LinkIcon
} from "lucide-react";
import * as React from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { AgentPreview } from "@/components/onboarding/agent-preview";
import { CompleteStep } from "@/components/onboarding/complete-step";
import { ProviderCard } from "@/components/onboarding/provider-card";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { WorkspaceCard } from "@/components/onboarding/workspace-card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { useConfigStore } from "@/stores/configStore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// Map icon names to icon components
const iconMap: Record<string, typeof LinkIcon> = {
  Link: LinkIcon,
  Key: Key,
  Activity: Activity,
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loadSession, completeOnboarding, fetchOnboardingProgress, onboardingProgress } = useAuthStore();
  const { config, fetchConfig } = useConfigStore();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [hasScroll, setHasScroll] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Load config, session and onboarding progress on mount
  React.useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchConfig(),
        loadSession(),
        fetchOnboardingProgress(),
      ]);
    };
    loadData();
  }, [fetchConfig, loadSession, fetchOnboardingProgress]);

  // Determine the correct step based on onboarding progress
  // Only auto-advance from welcome step - don't override user's navigation to later steps
  React.useEffect(() => {
    // Wait for progress to be fetched
    if (!onboardingProgress) return;

    // If onboarding is complete, redirect to agents
    if (onboardingProgress.onboardingComplete) {
      router.push("/agents");
      return;
    }

    // Only auto-determine step when on welcome screen (step 0)
    // This prevents auto-advancing when user completes actions that update progress
    if (currentStep !== 0) return;

    // Determine step based on progress
    let targetStep = 0;
    if (!onboardingProgress.hasProvider) {
      targetStep = 1; // provider step
    } else if (!onboardingProgress.hasProject) {
      targetStep = 2; // workspace step
    } else {
      targetStep = 3; // complete step
    }

    // Only update if different from current
    if (currentStep !== targetStep) {
      setCurrentStep(targetStep);
    }
  }, [onboardingProgress, router, currentStep]);

  // Also check user object for onboarding complete status
  React.useEffect(() => {
    if (user?.onboardingComplete) {
      router.push("/agents");
    }
  }, [user, router]);

  React.useEffect(() => {
    const checkScroll = () => {
      if (contentRef.current) {
        const hasScrollableContent = contentRef.current.scrollHeight > contentRef.current.clientHeight;
        setHasScroll(hasScrollableContent);
      }
    };

    const timeoutId = setTimeout(checkScroll, 0);
    window.addEventListener('resize', checkScroll);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkScroll);
    };
  }, [currentStep]);

  const handleFinish = async () => {
    setIsCompleting(true);
    try {
      await completeOnboarding();
      router.push("/agents");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      toast.error("Failed to complete onboarding. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  const userName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  // Get checklist from config or use fallback
  const defaultChecklist = [
    { id: 'connect-provider', icon: 'Link' as const, text: "Connect your LLM Provider" },
    { id: 'store-keys', icon: 'Key' as const, text: "Securely store API keys" },
    { id: 'capture-trace', icon: 'Activity' as const, text: "Capture your first trace" },
  ];
  const checklistRaw = config?.onboardingChecklist ?? defaultChecklist;
  const checklist = checklistRaw.map(item => ({
    ...item,
    icon: iconMap[item.icon] || LinkIcon,
  }));

  // Get step definitions from config or use fallback
  const defaultSteps = [
    { id: "welcome", label: "Welcome" },
    { id: "provider", label: "Provider" },
    { id: "workspace", label: "Workspace" },
    { id: "complete", label: "Complete" },
  ];
  const stepDefinitions = config?.onboardingSteps?.map(step => ({
    id: step.id,
    label: step.label,
  })) ?? defaultSteps;

  const steps = [
    {
      id: "welcome",
      title: (
        <>
          Welcome to WhyOps, <span className="text-primary">{userName}!</span>
        </>
      ),
      subtitle:
        "Let's get your AI agents observable in under 3 minutes. We'll guide you through the essentials to get you started.",
      content: (
        <div className="space-y-6">
          <ul className="space-y-4">
            {checklist.map((item) => (
              <li key={item.id || item.text} className="flex items-center gap-3 text-muted-foreground/80">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted border border-border/50 text-primary">
                  {item.icon && <item.icon className="h-5 w-5" />}
                </div>
                <span className="font-medium text-foreground">{item.text}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8"
              onClick={() => setCurrentStep(1)}
            >
              Let&apos;s Go
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <button
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4"
              onClick={() => setCurrentStep(1)}
            >
              Skip Tour
            </button>
          </div>
        </div>
      ),
      preview: <AgentPreview direction="vertical" />,
    },
    {
      id: "provider",
      title: "Connect your LLM Provider",
      subtitle:
        "Choose the primary LLM used by your agent for decision making. Add secondary providers later.",
      textAlign: 'center',
      content: null,
      preview: (
        <ProviderCard
          onBack={() => setCurrentStep(0)}
          onContinue={() => setCurrentStep(2)}
        />
      ),
    },
    {
      id: "workspace",
      title: "Set up your workspace",
      subtitle: "Create an API key to securely connect your AI agents to WhyOps.",
      textAlign: 'center',
      content: null,
      preview: (
        <WorkspaceCard
          onBack={() => setCurrentStep(1)}
          onContinue={() => setCurrentStep(3)}
        />
      ),
    },
    {
      id: "complete",
      title: "Connect your AI Agent",
      subtitle: "Install the SDK and add the decorator to start observing your agent's decisions.",
      textAlign: 'center',
      content: null,
      preview: (
        <CompleteStep
          onFinish={handleFinish}
          isFinishing={isCompleting}
        />
      ),
    },
  ];

  const activeStep = steps[currentStep];
  const showSplitLayout = currentStep === 0;

  // Show loading while checking progress
  if (!onboardingProgress) {
    return (
      <div className="relative h-screen overflow-hidden bg-grid">
        <div className="flex flex-col h-screen">
          <SiteHeader actionLabel="Log out" />
          <main className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-grid">
      <div className="flex flex-col h-screen">
        <SiteHeader actionLabel="Log out" />

        <main className="flex-1 overflow-y-auto px-12">
          <div className="mx-auto max-w-7xl">
            {/* Step Indicator */}
            <StepIndicator
              steps={stepDefinitions}
              currentStep={currentStep}
            />

            {/* Content Area */}
            <div
              ref={contentRef}
              className={cn(
                "pb-12 h-[calc(100dvh-10dvh-64px)] transition-all duration-200",
                hasScroll && "pt-[8dvh]",
                showSplitLayout ? "grid lg:grid-cols-2 items-center gap-[2vw]" : "flex flex-col items-center justify-center"
              )}
            >
              {/* Left Column - Text Content */}
              <div className={`flex flex-col gap-6 ${showSplitLayout ? '' : 'lg:max-w-2xl w-full'}`}>
                {(activeStep.title || activeStep.subtitle) && (
                  <div className="space-y-4">
                    {activeStep.title && (
                      <h2 className={cn("text-4xl font-semibold leading-tight text-foreground sm:text-5xl", activeStep.textAlign === 'center' && 'text-center')}>
                        {activeStep.title}
                      </h2>
                    )}
                    {activeStep.subtitle && (
                      <p className={cn("text-lg leading-relaxed text-muted-foreground", activeStep.textAlign === 'center' && 'text-center')}>
                        {activeStep.subtitle}
                      </p>
                    )}
                  </div>
                )}
                {activeStep.content && (
                  <div className="space-y-4 text-sm text-muted-foreground">
                    {activeStep.content}
                  </div>
                )}
              </div>

              {/* Right Column - Preview/Card */}
              <div className={cn(
                "flex items-start justify-center w-full",
                !showSplitLayout && "max-w-2xl"
              )}>
                {activeStep.preview}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
