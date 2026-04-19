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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-6">
          <Link
            href="/tools"
            className="text-sm font-semibold text-foreground"
          >
            WhyOps
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Sign in
            </Link>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Open WhyOps
            </Link>
          </div>
        </div>
        <ToolsNav />
      </header>
      <main className="mx-auto w-full max-w-[1280px] px-6 py-8">{children}</main>
    </div>
  );
}
