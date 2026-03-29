import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type KpiCardProps = {
  description?: string;
  label: string;
  tone: "danger" | "default" | "muted" | "success" | "warning";
  value: number;
};

const toneClassMap: Record<
  KpiCardProps["tone"],
  {
    accent: string;
    dot: string;
  }
> = {
  danger: {
    accent: "from-danger-600 to-danger-700",
    dot: "bg-danger-600",
  },
  default: {
    accent: "from-brand-700 to-brand-900",
    dot: "bg-brand-700",
  },
  muted: {
    accent: "from-ink-500 to-ink-900",
    dot: "bg-ink-500",
  },
  success: {
    accent: "from-success-600 to-success-700",
    dot: "bg-success-600",
  },
  warning: {
    accent: "from-warning-600 to-warning-700",
    dot: "bg-warning-600",
  },
};

export function KpiCard({ description, label, tone, value }: KpiCardProps) {
  const toneStyles = toneClassMap[tone];

  return (
    <Card className="min-h-[168px] overflow-hidden p-0">
      <div className={`h-1.5 bg-gradient-to-r ${toneStyles.accent}`} />
      <div className="flex h-full flex-col justify-between gap-5 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-4">
            <Badge tone={tone}>{label}</Badge>
            <div className="text-4xl font-semibold tracking-[-0.04em] text-ink-950">{value}</div>
          </div>
          <span className={`mt-1 h-3.5 w-3.5 rounded-full ${toneStyles.dot}`} />
        </div>
        {description ? <p className="text-sm leading-6 text-ink-700">{description}</p> : <div className="h-6" />}
      </div>
    </Card>
  );
}
