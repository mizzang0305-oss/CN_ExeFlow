import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type KpiCardProps = {
  label: string;
  tone: "danger" | "default" | "muted" | "success" | "warning";
  value: number;
};

export function KpiCard({ label, tone, value }: KpiCardProps) {
  return (
    <Card className="space-y-4">
      <Badge tone={tone}>{label}</Badge>
      <div className="text-3xl font-semibold tracking-tight text-ink-950">{value}</div>
    </Card>
  );
}
