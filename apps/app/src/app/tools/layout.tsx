import Link from "next/link";
import type { Metadata } from "next";
import { PropsWithChildren } from "react";
import { ToolsNav } from "@/components/tools/ToolsNav";
import { buttonVariants } from "@/components/ui/button";
import { TOOLS_INDEX_DEFINITION } from "@/constants/tools";
import { buildPublicPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    path: TOOLS_INDEX_DEFINITION.href,
    title: TOOLS_INDEX_DEFINITION.title,
    description: TOOLS_INDEX_DEFINITION.description,
    keywords: TOOLS_INDEX_DEFINITION.keywords,
  }),
  title: {
    default: "Free AI Agent Tools",
    template: "%s | WhyOps",
  },
};

export default function ToolsLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/50 bg-background">
        <div className="mx-auto flex min-h-14 max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/tools"
            className="text-sm font-semibold text-foreground"
          >
            WhyOps
          </Link>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex-1 sm:flex-none")}
            >
              Sign in
            </Link>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 sm:flex-none")}
            >
              Open WhyOps
            </Link>
          </div>
        </div>
        <ToolsNav />
      </header>
      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
