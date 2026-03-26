import * as React from "react";

import { cn } from "@/lib/utils";

const Badge = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex min-h-5 items-center rounded-sm border border-border/70 bg-surface-2/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80",
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

export { Badge };
