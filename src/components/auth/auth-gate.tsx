"use client";

import { PropsWithChildren, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/stores/authStore";

export function AuthGate({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { loadSession, hasSession, sessionChecked, user } = useAuthStore();

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!sessionChecked) return;

    if (pathname === "/") {
      if (!hasSession) return;

      if (user?.onboardingComplete === false) {
        router.replace("/onboarding");
        return;
      }

      router.replace("/agents");
      return;
    }

    if (!hasSession) {
      router.replace("/");
    }
  }, [hasSession, pathname, router, sessionChecked, user?.onboardingComplete]);

  if (pathname === "/" && (!sessionChecked || hasSession)) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-grid">
        <Spinner className="h-8 w-8 border-4 text-primary" />
      </div>
    );
  }

  return children;
}
