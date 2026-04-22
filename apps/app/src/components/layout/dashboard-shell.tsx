"use client";

import { useState } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface DashboardShellProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function DashboardShell({
  children,
  defaultCollapsed = false,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar
          defaultCollapsed={defaultCollapsed}
          className="hidden h-full shrink-0 lg:flex"
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardHeader onOpenSidebar={() => setMobileNavOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
            {children}
          </main>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[min(20rem,calc(100vw-1.5rem))] border-border/60 p-0"
        >
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <Sidebar
            defaultCollapsed={false}
            lockExpanded
            onNavigate={() => setMobileNavOpen(false)}
            className="h-full w-full border-r-0"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
