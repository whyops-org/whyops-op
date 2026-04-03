import { create } from "zustand";

import { apiRequest } from "@/lib/api-client";

type AuthStatus = "idle" | "loading" | "sent" | "error";
type SocialProvider = "github" | "google";

const RESEND_COOLDOWN_MS = 60_000;

export type OnboardingStep = "welcome" | "provider" | "workspace" | "complete";

export interface OnboardingProgress {
  hasProvider: boolean;
  hasProject: boolean;
  onboardingComplete: boolean;
  currentStep: OnboardingStep;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  onboardingComplete?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  onboardingProgress: OnboardingProgress | null;
  hasSession: boolean;
  sessionChecked: boolean;
  status: AuthStatus;
  oauthLoadingProvider: SocialProvider | null;
  error: string | null;
  email: string;
  resendAvailableAt: number | null;
  setEmail: (email: string) => void;
  resetMagicLink: () => void;
  sendMagicLink: (params?: { name?: string | null; callbackURL?: string; isResend?: boolean }) => Promise<void>;
  oauthLogin: (provider: SocialProvider) => Promise<void>;
  loadSession: () => Promise<void>;
  fetchOnboardingProgress: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

interface MagicLinkResponse {
  status?: string;
  data?: unknown;
}

interface SocialSignInResponse {
  url?: string;
  redirect?: boolean;
}

interface SessionContextResponse {
  session?: unknown | null;
  user?: AuthUser | null;
  authContext?: unknown | null;
}

const defaultCallbacks = {
  callbackURL: "/onboarding",
  newUserCallbackURL: "/onboarding",
  errorCallbackURL: "/",
};

let loadSessionPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((Set, Get) => ({
  user: null,
  onboardingProgress: null,
  hasSession: false,
  sessionChecked: false,
  status: "idle",
  oauthLoadingProvider: null,
  error: null,
  email: "",
  resendAvailableAt: null,
  setEmail: (email) => Set({ email, error: null }),
  resetMagicLink: () =>
    Set({
      status: "idle",
      oauthLoadingProvider: null,
      error: null,
      email: "",
    }),
  sendMagicLink: async ({ name, callbackURL } = {}) => {
    const { email } = Get();
    if (!email.trim()) {
      Set({ error: "Enter a valid email address.", status: "error" });
      return;
    }

    const { resendAvailableAt } = Get();
    if (resendAvailableAt && Date.now() < resendAvailableAt) {
      Set({ error: "Please wait before resending.", status: "error" });
      return;
    }

    Set({ status: "loading", error: null });

    try {
      const origin = window.location.origin;
      await apiRequest<MagicLinkResponse>("/api/auth/sign-in/magic-link", {
        method: "POST",
        body: {
          email,
          name: name ?? undefined,
          callbackURL: `${origin}${callbackURL ?? defaultCallbacks.callbackURL}`,
          newUserCallbackURL: `${origin}${defaultCallbacks.newUserCallbackURL}`,
          errorCallbackURL: `${origin}${defaultCallbacks.errorCallbackURL}`,
        },
      });

      const nextAvailableAt = Date.now() + RESEND_COOLDOWN_MS;
      Set({
        status: "sent",
        resendAvailableAt: nextAvailableAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send magic link.";
      Set({ status: "error", error: message });
    }
  },
  oauthLogin: async (provider) => {
    const origin = window.location.origin;
    Set({ oauthLoadingProvider: provider, error: null });
    try {
      const response = await apiRequest<SocialSignInResponse>("/api/auth/sign-in/social", {
        method: "POST",
        body: {
          provider,
          callbackURL: `${origin}/onboarding`,
          errorCallbackURL: `${origin}/`,
          disableRedirect: true,
        },
      });
      if (response.url) {
        window.location.href = response.url;
        return;
      }
      Set({ status: "error", error: "Failed to start OAuth login.", oauthLoadingProvider: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start OAuth login.";
      Set({ status: "error", error: message, oauthLoadingProvider: null });
    }
  },
  loadSession: async () => {
    if (Get().sessionChecked) {
      return;
    }

    if (loadSessionPromise) {
      return loadSessionPromise;
    }

    loadSessionPromise = (async () => {
      try {
        const response = await apiRequest<SessionContextResponse>("/api/session/context", {
          method: "GET",
        });
        const user = response.user ?? null;
        if (user) {
          Set({ user, hasSession: true, sessionChecked: true });
          return;
        }

        Set({ user: null, hasSession: false, sessionChecked: true });
      } catch {
        Set({ user: null, hasSession: false, sessionChecked: true });
      }
    })();

    try {
      await loadSessionPromise;
    } finally {
      loadSessionPromise = null;
    }
  },
  fetchOnboardingProgress: async () => {
    try {
      const response = await apiRequest<OnboardingProgress>("/api/users/me/onboarding", {
        method: "GET",
      });
      Set({ onboardingProgress: response });
    } catch (error) {
      console.error("Failed to fetch onboarding progress:", error);
    }
  },
  signOut: async () => {
    Set({ status: "loading", error: null });
    try {
      await apiRequest("/api/auth/sign-out", { method: "POST", body: {} });
      Set({ user: null, hasSession: false, sessionChecked: true, status: "idle", onboardingProgress: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign out.";
      Set({ status: "error", error: message });
    }
  },
  completeOnboarding: async () => {
    try {
      await apiRequest("/api/users/me", {
        method: "PUT",
        body: { onboardingComplete: true },
      });
      Set((state) => ({
        user: state.user ? { ...state.user, onboardingComplete: true } : null,
        onboardingProgress: state.onboardingProgress
          ? { ...state.onboardingProgress, onboardingComplete: true, currentStep: "complete" }
          : null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete onboarding.";
      Set({ error: message });
      throw new Error(message);
    }
  },
}));
