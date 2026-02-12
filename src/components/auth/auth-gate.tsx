"use client";

import { PropsWithChildren, useEffect } from "react";

import { useAuthStore } from "@/stores/authStore";

export function AuthGate({ children }: PropsWithChildren) {
  const {  loadSession } = useAuthStore();

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return children;
}
