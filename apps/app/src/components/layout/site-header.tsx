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
        "flex h-14 w-full items-center justify-between border-b border-border/50 px-6 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <Link href="/agents" className="flex items-center gap-2" aria-label="Go to agents">
        <LogoMark size="sm" />
        <span className="text-base font-semibold text-foreground">WhyOps</span>
      </Link>
      {actionLabel ? (
        <button
          className="rounded-sm border border-border/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2/50 hover:text-foreground"
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
