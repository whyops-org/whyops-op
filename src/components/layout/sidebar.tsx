"use client";

import { LogoMark } from "@/components/brand/logo-mark";
import { goToDocumentation } from "@/lib/helper";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Key,
  PanelLeft,
  PanelLeftClose,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultCollapsed?: boolean;
}

export function Sidebar({ className, defaultCollapsed = false, ...props }: SidebarProps) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    const match = document.cookie.match(new RegExp("(^| )sidebar:state=([^;]+)"));
    if (match) {
      const cookieValue = match[2] === "true";
      setIsCollapsed(cookieValue);
    }

    setTimeout(() => setIsMounted(true), 100);
  }, []);

  const transitionDuration = isMounted ? "duration-300" : "duration-0";

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    document.cookie = `sidebar:state=${newState}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  const handleAddProviderClick = () => {
    router.push("/settings?tab=providers");
  };

  const handleApiKeysClick = () => {
    router.push("/settings?tab=api-keys");
  };

  const handleDocumentationClick = () => {
    goToDocumentation();
  };

  const navItems = [
    {
      key: "add-provider",
      label: "Add Provider",
      icon: <PlusCircle className="h-4 w-4" />,
      onClick: handleAddProviderClick,
    },
    {
      key: "documentation",
      label: "Documentation",
      icon: <BookOpen className="h-4 w-4" />,
      onClick: handleDocumentationClick,
    },
    {
      key: "api-keys",
      label: "API Keys",
      icon: <Key className="h-4 w-4" />,
      onClick: handleApiKeysClick,
    },
  ];

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-border/50 bg-card transition-all ease-in-out",
        transitionDuration,
        isCollapsed ? "w-[72px]" : "w-60",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-border/40 transition-all",
          transitionDuration,
          isCollapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        <Link href="/agents" className="flex min-w-0 items-center gap-3" aria-label="Go to agents">
          <LogoMark size="sm" />
          <span
            className={cn(
              "origin-left whitespace-nowrap text-sm font-semibold text-foreground transition-all",
              transitionDuration,
              isCollapsed ? "hidden w-0 -translate-x-2 opacity-0" : "w-auto translate-x-0 opacity-100"
            )}
          >
            WhyOps
          </span>
        </Link>

        <button
          onClick={toggleSidebar}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
            isCollapsed && "hidden"
          )}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-5">
        <div className="mb-2">
          <p
            className={cn(
              "px-2 text-[11px] font-medium text-muted-foreground transition-all",
              transitionDuration,
              isCollapsed ? "h-0 -translate-x-2 overflow-hidden opacity-0" : "h-auto translate-x-0 opacity-100"
            )}
          >
            Platform
          </p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <SidebarItem
              key={item.key}
              icon={item.icon}
              isCollapsed={isCollapsed}
              label={item.label}
              onClick={item.onClick}
              transitionDuration={transitionDuration}
            />
          ))}
        </nav>
      </div>

      <div className="overflow-hidden border-t border-border/40 px-3 py-3">
        {isCollapsed ? (
          <button
            onClick={toggleSidebar}
            className="mx-auto grid h-8 w-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-sm border border-border/50 bg-surface-2/30 px-2.5 py-2 text-xs">
            <span className="font-medium text-foreground">System online</span>
            <span className="text-muted-foreground">v2.4.0</span>
          </div>
        )}
      </div>
    </aside>
  );
}

interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  transitionDuration: string;
}

function SidebarItem({
  icon,
  label,
  isCollapsed,
  transitionDuration,
  className,
  ...props
}: SidebarItemProps) {
  return (
    <button
      className={cn(
        "group flex w-full items-center rounded-sm text-sm text-muted-foreground transition-all hover:bg-surface-2 hover:text-foreground",
        transitionDuration,
        isCollapsed ? "mx-auto h-9 w-9 justify-center px-0" : "h-9 gap-2.5 px-2.5",
        className
      )}
      title={isCollapsed ? label : undefined}
      {...props}
    >
      <span className="shrink-0">{icon}</span>
      <span
        className={cn(
          "origin-left truncate whitespace-nowrap transition-all",
          transitionDuration,
          isCollapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
        )}
      >
        {label}
      </span>
    </button>
  );
}
