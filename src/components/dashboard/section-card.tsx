import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Card } from "../ui/card";

type SectionCardProps = {
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: string;
  eyebrow?: string;
  headerAside?: ReactNode;
  title: string;
};

export function SectionCard({
  badge,
  children,
  className,
  contentClassName,
  description,
  eyebrow,
  headerAside,
  title,
}: SectionCardProps) {
  return (
    <Card className={cn("h-full overflow-hidden p-0", className)}>
      <div className="flex flex-col gap-4 border-b border-ink-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
          ) : null}
          <div className="space-y-1">
            <h2 className="section-title">{title}</h2>
            {description ? <p className="text-sm leading-6 text-ink-700">{description}</p> : null}
          </div>
        </div>
        {badge || headerAside ? (
          <div className="flex shrink-0 items-center gap-2 self-start">
            {badge}
            {headerAside}
          </div>
        ) : null}
      </div>
      <div className={cn("flex h-full flex-col gap-3 px-5 py-5 sm:px-6", contentClassName)}>{children}</div>
    </Card>
  );
}
