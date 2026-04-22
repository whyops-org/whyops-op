import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo-mark";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

interface SiteHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  actionLabel?: string;
}

export function SiteHeader({ actionLabel, className, ...props }: SiteHeaderProps) {
  const router = useRouter();
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <header
      className={cn(
        "flex min-h-14 w-full flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3 text-sm text-muted-foreground sm:px-6",
        className
      )}
      {...props}
    >
      <Link href="/agents" className="flex min-w-0 items-center gap-2" aria-label="Go to agents">
        <LogoMark size="sm" />
        <span className="truncate text-base font-semibold text-foreground">WhyOps</span>
      </Link>
      {actionLabel ? (
        <button
          className="shrink-0 rounded-sm border border-border/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2/50 hover:text-foreground"
          onClick={async () => {
            await signOut();
            router.replace("/");
          }}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </header>
  );
}
