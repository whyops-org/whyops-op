import { create } from "zustand";

import { apiRequest, buildAuthUrl } from "@/lib/api";

type AuthStatus = "idle" | "loading" | "sent" | "error";

const RESEND_COOLDOWN_MS = 60_000;

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  onboardingComplete?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  hasSession: boolean;
  sessionChecked: boolean;
  status: AuthStatus;
  error: string | null;
  email: string;
  resendAvailableAt: number | null;
  setEmail: (email: string) => void;
  resetMagicLink: () => void;
  sendMagicLink: (params?: { name?: string | null; callbackURL?: string; isResend?: boolean }) => Promise<void>;
  oauthLogin: (provider: "github" | "google") => void;
  loadSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface MagicLinkResponse {
  status?: string;
  data?: unknown;
}

interface SocialSignInResponse {
  url?: string;
  redirect?: boolean;
}

interface SessionResponse {
  session?: unknown | null;
  user?: AuthUser | null;
  data?: {
    user?: AuthUser | null;
  };
}

interface CurrentUserResponse {
  id: string;
  email: string;
  name?: string | null;
  metadata?: Record<string, unknown>;
  onboardingComplete?: boolean;
  isActive?: boolean;
}

const defaultCallbacks = {
  callbackURL: "/onboarding",
  newUserCallbackURL: "/onboarding",
  errorCallbackURL: "/",
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hasSession: false,
  sessionChecked: false,
  status: "idle",
  error: null,
  email: "",
  resendAvailableAt: null,
  setEmail: (email) => set({ email, error: null }),
  resetMagicLink: () =>
    set({
      status: "idle",
      error: null,
      email: "",
    }),
  sendMagicLink: async ({ name, callbackURL } = {}) => {
    const { email } = get();
    if (!email.trim()) {
      set({ error: "Enter a valid email address.", status: "error" });
      return;
    }

    const { resendAvailableAt } = get();
    if (resendAvailableAt && Date.now() < resendAvailableAt) {
      set({ error: "Please wait before resending.", status: "error" });
      return;
    }

    set({ status: "loading", error: null });

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
      set({
        status: "sent",
        resendAvailableAt: nextAvailableAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send magic link.";
      set({ status: "error", error: message });
    }
  },
  oauthLogin: (provider) => {
    const origin = window.location.origin;
    apiRequest<SocialSignInResponse>("/api/auth/sign-in/social", {
      method: "POST",
      body: {
        provider,
        callbackURL: `${origin}/onboarding`,
        errorCallbackURL: `${origin}/`,
        disableRedirect: true,
      },
    })
      .then((response) => {
        if (response.url) {
          window.location.href = response.url;
        } else {
          set({ status: "error", error: "Failed to start OAuth login." });
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to start OAuth login.";
        set({ status: "error", error: message });
      });
  },
  loadSession: async () => {
    try {
      const response = await apiRequest<SessionResponse>("/api/auth/get-session", {
        method: "GET",
      });
      const user = response.user ?? response.data?.user ?? null;
      if (user) {
        try {
          const currentUser = await apiRequest<CurrentUserResponse>("/api/users/me", {
            method: "GET",
          });
          set({
            user: {
              ...user,
              onboardingComplete: Boolean(currentUser.onboardingComplete),
            },
            hasSession: true,
            sessionChecked: true,
          });
          return;
        } catch {
          set({ user, hasSession: true, sessionChecked: true });
          return;
        }
      }

      set({ user: null, hasSession: false, sessionChecked: true });
    } catch {
      set({ user: null, hasSession: false, sessionChecked: true });
    }
  },
  signOut: async () => {
    set({ status: "loading", error: null });
    try {
      await apiRequest("/api/auth/sign-out", { method: "POST" });
      set({ user: null, hasSession: false, sessionChecked: true, status: "idle" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign out.";
      set({ status: "error", error: message });
    }
  },
}));
