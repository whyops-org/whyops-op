import * as React from "react";
import { useRouter } from "next/navigation";

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
        "flex w-full items-center justify-between px-6 py-5 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <LogoMark size="sm" />
        <span className="text-base font-semibold text-foreground">WhyOps</span>
      </div>
      {actionLabel ? (
        <button
          className="text-sm font-semibold text-foreground/80 hover:text-foreground"
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
