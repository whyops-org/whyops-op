import * as React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md";
}

export function LogoMark({ className, size = "md", ...props }: LogoMarkProps) {
  const sizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
  };

  return (
    <div
      className={cn(
        "relative block overflow-hidden rounded-sm",
        sizes[size],
        className
      )}
      {...props}
    >
      <Image
        src="/assets/WhyOpsLogo.svg"
        alt="WhyOps"
        fill
        sizes={size === "sm" ? "24px" : "32px"}
        className="object-contain"
      />
    </div>
  );
}
