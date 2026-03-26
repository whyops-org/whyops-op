"use client";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

const DIFF_VIEWER_MIN_HEIGHT_CLASS = "min-h-[22rem]";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => (
    <div
      className={cn(
        "rounded-sm border border-border/60 bg-surface-2/40 px-4 py-10 text-center text-sm text-muted-foreground",
        DIFF_VIEWER_MIN_HEIGHT_CLASS,
        "flex items-center justify-center"
      )}
    >
      Loading diff viewer...
    </div>
  ),
});

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  leftTitle?: string;
  rightTitle?: string;
  className?: string;
  splitView?: boolean;
  showDiffOnly?: boolean;
  extraLinesSurroundingDiff?: number;
}

const DIFF_STYLES = {
  variables: {
    light: {
      diffViewerBackground: "var(--card)",
      diffViewerColor: "var(--foreground)",
      diffViewerTitleBackground: "var(--surface-2)",
      diffViewerTitleColor: "var(--foreground)",
      diffViewerTitleBorderColor: "var(--border)",
      addedBackground: "color-mix(in srgb, var(--primary) 14%, transparent)",
      addedColor: "var(--foreground)",
      removedBackground: "color-mix(in srgb, var(--destructive) 12%, transparent)",
      removedColor: "var(--foreground)",
      changedBackground: "color-mix(in srgb, var(--warning) 14%, transparent)",
      wordAddedBackground: "color-mix(in srgb, var(--primary) 26%, transparent)",
      wordRemovedBackground: "color-mix(in srgb, var(--destructive) 24%, transparent)",
      addedGutterBackground: "color-mix(in srgb, var(--primary) 10%, transparent)",
      removedGutterBackground: "color-mix(in srgb, var(--destructive) 10%, transparent)",
      gutterBackground: "var(--surface-2)",
      gutterBackgroundDark: "var(--surface-2)",
      highlightBackground: "var(--surface-3)",
      highlightGutterBackground: "var(--surface-3)",
      codeFoldBackground: "var(--surface-2)",
      codeFoldGutterBackground: "var(--surface-2)",
      emptyLineBackground: "var(--surface)",
      gutterColor: "var(--muted-foreground)",
      addedGutterColor: "var(--foreground)",
      removedGutterColor: "var(--foreground)",
      codeFoldContentColor: "var(--muted-foreground)",
    },
  },
  line: {
    fontSize: 12,
    lineHeight: 1.6,
  },
  marker: {
    minWidth: 24,
  },
  contentText: {
    fontFamily:
      "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace)",
  },
  titleBlock: {
    fontSize: 12,
    fontWeight: 600,
  },
  summary: {
    fontSize: 12,
  },
} as const;

export function DiffViewer({
  oldValue,
  newValue,
  leftTitle = "Original",
  rightTitle = "Suggested",
  className,
  splitView = true,
  showDiffOnly = true,
  extraLinesSurroundingDiff = 6,
}: DiffViewerProps) {
  return (
    <div className={cn("rounded-sm border border-border/60 bg-card", DIFF_VIEWER_MIN_HEIGHT_CLASS, className)}>
      <div className="overflow-x-auto">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          leftTitle={leftTitle}
          rightTitle={rightTitle}
          splitView={splitView}
          showDiffOnly={showDiffOnly}
          extraLinesSurroundingDiff={extraLinesSurroundingDiff}
          disableWordDiff={false}
          hideLineNumbers={false}
          styles={DIFF_STYLES}
        />
      </div>
    </div>
  );
}
