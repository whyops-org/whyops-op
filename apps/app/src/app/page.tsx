"use client";

import { AuthCard } from "@/components/onboarding/auth-card";

export default function Home() {
  return (
    <div className="min-h-dvh bg-grid">
      <main className="mx-auto flex min-h-dvh w-full max-w-[1120px] items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <AuthCard />
      </main>
    </div>
  );
}
