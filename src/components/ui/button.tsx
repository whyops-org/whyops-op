import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(19,199,163,0.25)] hover:bg-primary/90",
        outline:
          "border border-border/70 bg-transparent text-foreground hover:border-border hover:bg-surface-2",
        ghost: "bg-transparent text-foreground/80 hover:text-foreground",
        muted:
          "bg-surface-2 text-foreground/80 hover:bg-surface-3 hover:text-foreground",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>
          {children}
        </span>
        {loading ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        ) : null}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
