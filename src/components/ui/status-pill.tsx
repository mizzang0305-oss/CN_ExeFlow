import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type StatusTone = "danger" | "default" | "muted" | "success" | "warning";

type StatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

const toneClassMap: Record<StatusTone, string> = {
  danger: "border-danger-200 bg-danger-50 text-danger-700",
  default: "border-brand-100 bg-brand-50 text-brand-700",
  muted: "border-white/14 bg-white/8 text-white",
  success: "border-success-200 bg-success-50 text-success-700",
  warning: "border-warning-200 bg-warning-50 text-warning-700",
};

const dotClassMap: Record<StatusTone, string> = {
  danger: "bg-danger-600",
  default: "bg-brand-500",
  muted: "bg-brand-200",
  success: "bg-success-600",
  warning: "bg-warning-600",
};

export function StatusPill({
  children,
  className,
  tone = "default",
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.08em]",
        toneClassMap[tone],
        className,
      )}
      {...props}
    >
      <span className={cn("h-2 w-2 rounded-full", dotClassMap[tone])} />
      {children}
    </span>
  );
}
