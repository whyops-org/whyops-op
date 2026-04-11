import * as React from "react";

import { useAuthStore } from "@/stores/authStore";
import { useConfigStore } from "@/stores/configStore";

export function useOnboardingBootstrap({
  fetchConfig,
  fetchOnboardingProgress,
  loadSession,
}: {
  fetchConfig: () => Promise<void>;
  fetchOnboardingProgress: () => Promise<void>;
  loadSession: () => Promise<void>;
}) {
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setIsBootstrapping(true);
    setLoadError(null);
    await Promise.all([fetchConfig(), loadSession(), fetchOnboardingProgress()]);

    const configError = useConfigStore.getState().error;
    const onboardingProgress = useAuthStore.getState().onboardingProgress;
    if (configError) {
      setLoadError(configError);
    } else if (!onboardingProgress) {
      setLoadError("Failed to load onboarding progress.");
    }
    setIsBootstrapping(false);
  }, [fetchConfig, loadSession, fetchOnboardingProgress]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  return { isBootstrapping, loadData, loadError };
}
