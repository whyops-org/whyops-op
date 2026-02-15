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
        "flex items-center justify-between border-b border-border/50 bg-background px-6 py-3",
        className
      )}
      {...props}
    >
      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70 hover:bg-surface-2 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right Side Actions */}
      <div className="flex items-center gap-3">
        <button
          className="grid h-9 w-9 place-items-center rounded-lg text-foreground/70 transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Notifications"
        >
          <BellIcon />
        </button>
        <UserDropdown userEmail={user?.email} />
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.5 15C6.5 16.1046 7.39543 17 8.5 17C9.60457 17 10.5 16.1046 10.5 15M13.5 6C13.5 4.67392 12.9732 3.40215 12.0355 2.46447C11.0979 1.52678 9.82608 1 8.5 1C7.17392 1 5.90215 1.52678 4.96447 2.46447C4.02678 3.40215 3.5 4.67392 3.5 6C3.5 9.5 2 10.5 2 10.5H15C15 10.5 13.5 9.5 13.5 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
