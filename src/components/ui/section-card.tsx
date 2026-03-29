import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Card } from "./card";

type SectionAccent = "brand" | "danger" | "neutral" | "success" | "warning";

type SectionCardProps = HTMLAttributes<HTMLDivElement> & {
  accent?: SectionAccent;
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
};

const accentClassMap: Record<SectionAccent, string> = {
  brand:
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,244,255,0.92))] border-brand-100/90",
  danger:
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,241,0.9))] border-danger-200/85",
  neutral:
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,246,252,0.92))] border-white/70",
  success:
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,255,246,0.9))] border-success-200/85",
  warning:
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,236,0.92))] border-warning-200/85",
};

const railClassMap: Record<SectionAccent, string> = {
  brand: "from-brand-500/10 via-brand-600 to-brand-500/10",
  danger: "from-danger-600/10 via-danger-600 to-danger-600/10",
  neutral: "from-ink-200/10 via-ink-300 to-ink-200/10",
  success: "from-success-600/10 via-success-600 to-success-600/10",
  warning: "from-warning-600/10 via-warning-600 to-warning-600/10",
};

export function SectionCard({
  accent = "neutral",
  action,
  children,
  className,
  description,
  eyebrow,
  title,
  ...props
}: SectionCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", accentClassMap[accent], className)} {...props}>
      <div className={cn("pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r", railClassMap[accent])} />
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {eyebrow ? (
              <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-500 uppercase">{eyebrow}</p>
            ) : null}
            <div>
              <h2 className="section-title">{title}</h2>
              {description ? <p className="mt-1 text-sm leading-6 text-ink-700">{description}</p> : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        {children}
      </div>
    </Card>
  );
}
