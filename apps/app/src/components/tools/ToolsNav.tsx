"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOOL_DEFINITIONS } from "@/constants/tools";
import { cn } from "@/lib/utils";

export function ToolsNav() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-border/50">
      <div className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        <Link
          href="/tools"
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-sm px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-2/60 hover:text-foreground",
            pathname === "/tools" && "bg-surface-2 text-foreground",
          )}
        >
          Overview
        </Link>
        {TOOL_DEFINITIONS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-sm px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-2/60 hover:text-foreground",
              pathname === tool.href && "bg-surface-2 text-foreground",
            )}
          >
            {tool.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
