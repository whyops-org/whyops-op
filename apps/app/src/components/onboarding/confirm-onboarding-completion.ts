import { apiRequest } from "@/lib/api-client";
import { useAuthStore, type OnboardingProgress } from "@/stores/authStore";

interface SessionConfirmationResponse {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    onboardingComplete?: boolean;
  } | null;
}

export async function confirmOnboardingCompletion() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [latestSession, latestProgress] = await Promise.all([
      apiRequest<SessionConfirmationResponse>("/api/session/context", { method: "GET" }),
      apiRequest<OnboardingProgress>("/api/users/me/onboarding", { method: "GET" }),
    ]);

    useAuthStore.setState((state) => ({
      user: latestSession.user ?? state.user,
      onboardingProgress: latestProgress,
    }));

    if (latestSession.user?.onboardingComplete || latestProgress.onboardingComplete) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}
