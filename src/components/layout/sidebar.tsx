import { LogoMark } from "@/components/brand/logo-mark";
import { cn } from "@/lib/utils";
import * as React from "react";

type SidebarProps = React.HTMLAttributes<HTMLDivElement>;

export function Sidebar({ className, ...props }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-screen w-47.5 flex-col border-r border-border/50 bg-card",
        className
      )}
      {...props}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-6">
        <LogoMark size="sm" />
        <span className="text-base font-semibold text-foreground">WhyOps</span>
      </div>

      {/* Quick Actions */}
      <div className="flex-1 px-3">
        <div className="mb-3">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Actions
          </p>
          <nav className="space-y-1">
            <SidebarItem icon={<PlusIcon />}>Add Provider</SidebarItem>
            <SidebarItem icon={<DocumentIcon />}>View Docs</SidebarItem>
            <SidebarItem icon={<KeyIcon />}>API Keys</SidebarItem>
          </nav>
        </div>
      </div>

      {/* System Status */}
      <div className="border-t border-border/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(46,230,193,0.6)]" />
          <span className="text-xs text-muted-foreground">
            System Status: <span className="text-foreground">Online</span>
          </span>
        </div>
      </div>
    </aside>
  );
}

interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

function SidebarItem({ icon, children, className, ...props }: SidebarItemProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-surface-2 hover:text-foreground",
        className
      )}
      {...props}
    >
      {icon && <span className="text-foreground/60">{icon}</span>}
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 5.5V10.5M5.5 8H10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 2.5H9.5L12 5V13.5H4V2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9.5 2.5V5H12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 7.5H10M6 9.5H10M6 11.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="5.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7.5 8.5L13 3M13 3H11M13 3V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
