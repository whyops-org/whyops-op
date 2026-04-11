export type AuthStatus = "idle" | "loading" | "sent" | "error";
export type SocialProvider = "github" | "google";
export type OnboardingStep = "welcome" | "workspace" | "complete";

export interface OnboardingProgress {
  hasProvider: boolean;
  hasProject: boolean;
  onboardingComplete: boolean;
  currentStep: OnboardingStep;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  onboardingComplete?: boolean;
}

export interface MagicLinkResponse {
  status?: string;
  data?: unknown;
}

export interface SocialSignInResponse {
  url?: string;
  redirect?: boolean;
}

export interface SessionContextResponse {
  session?: unknown | null;
  user?: AuthUser | null;
  authContext?: unknown | null;
}
