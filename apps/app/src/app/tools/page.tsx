import Link from "next/link";
import type { Metadata } from "next";
import { TOOL_DEFINITIONS, TOOLS_INDEX_DEFINITION } from "@/constants/tools";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buildPublicPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = buildPublicPageMetadata({
  path: TOOLS_INDEX_DEFINITION.href,
  title: TOOLS_INDEX_DEFINITION.title,
  description: TOOLS_INDEX_DEFINITION.description,
  keywords: TOOLS_INDEX_DEFINITION.keywords,
});

export default function ToolsIndexPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-border/50 pb-5">
        <h1 className="text-3xl font-semibold text-foreground">
          Free tools
        </h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Public tools for inspecting runs, checking drift, pricing models, and
          finding loops. They run inside the same WhyOps app surface and use the
          same parsing and analysis pipeline as the product.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            Each tool accepts pasted data and returns structured output without
            a login requirement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {TOOL_DEFINITIONS.map((tool, index) => (
            <div key={tool.href}>
              {index > 0 ? <Separator /> : null}
              <div className="grid gap-4 py-5 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
                <div className="space-y-1">
                  <Link
                    href={tool.href}
                    className="text-base font-semibold text-foreground hover:text-primary"
                  >
                    {tool.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{tool.summary}</p>
                </div>
                <div className="text-sm leading-6 text-muted-foreground">
                  {tool.useCase}
                </div>
                <div className="flex items-start justify-between gap-4 lg:justify-end">
                  <p className="max-w-[220px] text-sm leading-6 text-muted-foreground">
                    {tool.output}
                  </p>
                  <Link
                    href={tool.href}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "shrink-0",
                    )}
                  >
                    Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhyOps</CardTitle>
          <CardDescription>
            The hosted product watches these same failure modes continuously, so
            you do not need to paste logs back in after every incident.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open WhyOps
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
