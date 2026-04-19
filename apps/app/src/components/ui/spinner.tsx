import * as React from "react";

import { cn } from "@/lib/utils";

export type SpinnerProps = React.HTMLAttributes<HTMLSpanElement>;

const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      {...props}
    />
  )
);

Spinner.displayName = "Spinner";

export { Spinner };
