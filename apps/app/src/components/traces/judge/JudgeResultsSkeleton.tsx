import { JUDGE_SKELETON_DIMENSION_CARD_COUNT } from "./constants";

export function JudgeResultsSkeleton() {
  return (
    <div className="space-y-5">
      <section className="rounded-sm border border-border/60 bg-card px-5 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="h-24 w-24 rounded-sm border border-border/60 bg-surface-2/65" />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-6 w-52 rounded-sm bg-surface-2/65" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`meta-skeleton-${index}`}
                  className="h-9 rounded-sm border border-border/50 bg-surface-2/55"
                />
              ))}
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`severity-skeleton-${index}`}
                  className="h-7 w-20 rounded-sm border border-border/50 bg-surface-2/55"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: JUDGE_SKELETON_DIMENSION_CARD_COUNT }).map((_, index) => (
          <section key={`dimension-skeleton-${index}`} className="space-y-3 rounded-sm border border-border/55 bg-background/80 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded-sm bg-surface-2/65" />
              <div className="h-9 w-9 rounded-sm bg-surface-2/65" />
            </div>
            <div className="h-2 rounded-sm bg-surface-2/65" />
            <div className="flex gap-3">
              <div className="h-4 w-20 rounded-sm bg-surface-2/65" />
              <div className="h-4 w-20 rounded-sm bg-surface-2/65" />
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-sm border border-border/60 bg-surface-2/20 px-4 py-6">
        <div className="space-y-3">
          <div className="h-5 w-44 rounded-sm bg-surface-2/65" />
          <div className="grid gap-2 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`finding-skeleton-${index}`}
                className="h-24 rounded-sm border border-border/55 bg-surface-2/45"
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Preparing structured findings. The panel will update in place as results stream.
          </p>
        </div>
      </section>
    </div>
  );
}
