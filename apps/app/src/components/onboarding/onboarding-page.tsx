"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  buildOnboardingSteps,
  getOnboardingStepDefinitions,
} from "@/components/onboarding/onboarding-page-steps";
import { confirmOnboardingCompletion } from "@/components/onboarding/confirm-onboarding-completion";
import { OnboardingErrorState } from "@/components/onboarding/onboarding-error-state";
import { OnboardingPageFrame } from "@/components/onboarding/onboarding-page-frame";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { useOnboardingBootstrap } from "@/components/onboarding/use-onboarding-bootstrap";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useConfigStore } from "@/stores/configStore";

function getTargetStep(hasProject: boolean) {
  return hasProject ? 2 : 1;
}

export function OnboardingPage() {
  const router = useRouter();
  const { config, fetchConfig } = useConfigStore();
  const {
    user,
    onboardingProgress,
    loadSession,
    completeOnboarding,
    fetchOnboardingProgress,
  } = useAuthStore();

  const [currentStep, setCurrentStep] = React.useState(0);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const hasAutoRoutedStep = React.useRef(false);
  const { isBootstrapping, loadData, loadError } = useOnboardingBootstrap({
    fetchConfig,
    loadSession,
    fetchOnboardingProgress,
  });

  React.useEffect(() => {
    if (!onboardingProgress) return;
    if (onboardingProgress.onboardingComplete) {
      router.push("/agents");
      return;
    }
    if (hasAutoRoutedStep.current) return;

    const targetStep = getTargetStep(onboardingProgress.hasProject);
    setCurrentStep(targetStep);
    hasAutoRoutedStep.current = true;
  }, [onboardingProgress, router]);

  React.useEffect(() => {
    if (user?.onboardingComplete) {
      router.push("/agents");
    }
  }, [router, user]);

  const handleFinish = async () => {
    setIsCompleting(true);
    try {
      await completeOnboarding();
      const completionConfirmed = await confirmOnboardingCompletion();
      if (!completionConfirmed) {
        throw new Error("Could not confirm onboarding completion yet. Please try again.");
      }

      window.location.assign("/agents");
      return;
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to complete onboarding. Please try again.";
      toast.error(message);
    } finally {
      setIsCompleting(false);
    }
  };

  const userName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const stepDefinitions = getOnboardingStepDefinitions(config);
  const steps = buildOnboardingSteps({
    config,
    userName,
    isFinishing: isCompleting,
    hasProvider: onboardingProgress?.hasProvider ?? false,
    onFinish: handleFinish,
    onStartSetup: () => setCurrentStep(1),
    onBackToWelcome: () => setCurrentStep(0),
    onContinueFromWorkspace: () => setCurrentStep(2),
    onBackToWorkspace: () => setCurrentStep(1),
  });

  if (!onboardingProgress && isBootstrapping) {
    return (
      <OnboardingPageFrame mainClassName="flex flex-1 items-center justify-center">
        <Spinner className="h-8 w-8 border-4 text-primary" />
      </OnboardingPageFrame>
    );
  }

  if (!onboardingProgress) {
    return (
      <OnboardingPageFrame mainClassName="flex flex-1 items-center justify-center px-6">
        <OnboardingErrorState
          title="Couldn’t load onboarding"
          message={loadError || "The onboarding state is unavailable right now."}
          onRetry={loadData}
        />
      </OnboardingPageFrame>
    );
  }

  const activeStepIndex = Math.min(currentStep, steps.length - 1);
  const activeStep = steps[activeStepIndex];
  const sharedTitle = (
    <div className={cn("space-y-4", activeStepIndex !== 0 && "mx-auto max-w-[620px] text-center")}>
      <h2 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
        {activeStep.title}
      </h2>
      <p className="text-lg leading-relaxed text-muted-foreground">{activeStep.subtitle}</p>
      {activeStep.content ? (
        <div className="space-y-4 text-sm text-muted-foreground">{activeStep.content}</div>
      ) : null}
    </div>
  );

  return (
    <OnboardingPageFrame>
      <div className="mx-auto flex h-full max-w-6xl flex-col py-6">
        <StepIndicator steps={stepDefinitions} currentStep={activeStepIndex} />
        <div className="min-h-0 flex-1 pt-8">
          <div
            className={cn(
              "h-full",
              activeStepIndex === 0
                ? "grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] lg:items-center"
                : "mx-auto flex max-w-[760px] flex-col justify-center gap-8 pb-24"
            )}
          >
            {activeStepIndex === 0 ? (
              <>
                <div className="flex max-w-2xl flex-col justify-center gap-6">{sharedTitle}</div>
                <div className="flex h-[560px] w-full items-stretch justify-self-stretch">
                  {activeStep.preview}
                </div>
              </>
            ) : (
              <>
                {sharedTitle}
                <div className="h-[min(560px,100%)] w-full">{activeStep.preview}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </OnboardingPageFrame>
  );
}
