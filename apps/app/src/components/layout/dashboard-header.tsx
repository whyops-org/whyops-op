"use client";

import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { UserDropdown } from "@/components/layout/user-dropdown";

const navItems = [
  { label: "Agents", href: "/agents" },
  { label: "Traces", href: "/traces" },
  { label: "Settings", href: "/settings" },
];

interface DashboardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onOpenSidebar?: () => void;
}

export function DashboardHeader({
  className,
  onOpenSidebar,
  ...props
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const activeNavItem = navItems.find(
    (item) =>
      pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
  );

  return (
    <header
      className={cn(
        "flex min-h-16 items-center justify-between gap-3 border-b border-border/50 bg-background px-4 py-3 sm:px-6 lg:px-7",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 border border-border/50 p-0 lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="min-w-0 lg:hidden">
          <p className="truncate text-sm font-semibold text-foreground">
            {activeNavItem?.label ?? "Workspace"}
          </p>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto sm:flex">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-sm border px-3 py-2 text-sm font-medium transition-colors",
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
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <UserDropdown userEmail={user?.email} />
      </div>
    </header>
  );
}
