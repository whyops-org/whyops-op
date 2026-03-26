"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { useAuthStore } from "@/stores/authStore";
import { UserDropdown } from "@/components/layout/user-dropdown";

const navItems = [
  { label: "Agents", href: "/agents" },
  { label: "Traces", href: "/traces" },
  { label: "Settings", href: "/settings" },
];

type DashboardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function DashboardHeader({ className, ...props }: DashboardHeaderProps) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  return (
    <header
      className={cn(
        "flex h-16 items-center justify-between border-b border-border/50 bg-background px-6 lg:px-7",
        className
      )}
      {...props}
    >
      <nav className="flex items-center gap-1.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-sm border px-3.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-border bg-card text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-surface-2/50 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <UserDropdown userEmail={user?.email} />
      </div>
    </header>
  );
}
