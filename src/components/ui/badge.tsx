import { cn } from "@/lib/utils";

type BadgeTone = "danger" | "default" | "muted" | "success" | "warning";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
};

const toneClassMap: Record<BadgeTone, string> = {
  danger: "bg-danger-50 text-danger-700",
  default: "bg-brand-50 text-brand-600",
  muted: "bg-ink-100 text-ink-700",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        toneClassMap[tone],
      )}
    >
      {children}
    </span>
  );
}
