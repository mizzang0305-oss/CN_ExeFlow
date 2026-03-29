import Link from "next/link";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type KpiCardProps = {
  description?: string;
  href?: string;
  label: string;
  tone: "danger" | "default" | "muted" | "success" | "warning";
  value: number;
};

const accentBarClassMap: Record<KpiCardProps["tone"], string> = {
  danger: "from-danger-600 to-danger-200",
  default: "from-brand-600 to-brand-200",
  muted: "from-ink-500 to-ink-200",
  success: "from-success-600 to-success-200",
  warning: "from-warning-600 to-warning-200",
};

const toneClassMap: Record<KpiCardProps["tone"], string> = {
  danger:
    "border-danger-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,241,0.9))]",
  default:
    "border-brand-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,244,255,0.92))]",
  muted:
    "border-ink-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,246,252,0.92))]",
  success:
    "border-success-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,255,246,0.9))]",
  warning:
    "border-warning-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,236,0.92))]",
};

const numberFormatter = new Intl.NumberFormat("ko-KR");

function KpiCardContent({ description, href, label, tone, value }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden transition",
        toneClassMap[tone],
        href
          ? "cursor-pointer border-transparent hover:border-brand-300 hover:shadow-[0_28px_62px_rgba(6,18,38,0.14)]"
          : undefined,
      )}
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <Badge tone={tone}>{label}</Badge>
          <span className="text-[11px] font-semibold tracking-[0.2em] text-ink-500 uppercase">
            {href ? "상세 이동" : "실시간"}
          </span>
        </div>

        <div className="space-y-2">
          <div className="text-4xl font-semibold tracking-tight text-ink-950">
            {numberFormatter.format(value)}
          </div>
          {description ? <p className="text-sm leading-6 text-ink-700">{description}</p> : null}
        </div>

        <div className="h-2 rounded-full bg-white/70">
          <div className={cn("h-full w-3/4 rounded-full bg-gradient-to-r", accentBarClassMap[tone])} />
        </div>
      </div>
    </Card>
  );
}

export function KpiCard(props: KpiCardProps) {
  if (!props.href) {
    return <KpiCardContent {...props} />;
  }

  return (
    <Link href={props.href} className="block">
      <KpiCardContent {...props} />
    </Link>
  );
}
