"use client";

import { AuthCard } from "@/components/onboarding/auth-card";

export default function Home() {
  return (
    <div className="relative h-dvh overflow-hidden bg-grid">
      <main className="relative mx-auto flex h-dvh w-full items-center justify-center overflow-x-hidden px-6 py-10">
        <AuthCard />
      </main>
    </div>
  );
}
