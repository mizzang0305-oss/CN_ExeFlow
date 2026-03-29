import { cn } from "@/lib/utils";

type BadgeTone = "danger" | "default" | "muted" | "success" | "warning";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
};

const toneClassMap: Record<BadgeTone, string> = {
  danger: "border border-danger-200 bg-danger-50 text-danger-700",
  default: "border border-brand-100 bg-brand-50 text-brand-700",
  muted: "border border-ink-200 bg-ink-100 text-ink-700",
  success: "border border-success-200 bg-success-50 text-success-700",
  warning: "border border-warning-200 bg-warning-50 text-warning-700",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em]",
        toneClassMap[tone],
      )}
    >
      {children}
    </span>
  );
}
