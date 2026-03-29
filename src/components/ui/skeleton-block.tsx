import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function SkeletonBlock({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden bg-ink-100/90", className)}
      {...props}
    >
      <div className="brand-shimmer absolute inset-y-0 -left-1/2 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.88),transparent)]" />
    </div>
  );
}
