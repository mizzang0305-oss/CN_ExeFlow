import { Badge } from "@/components/ui/badge";

export function UrgencyBadge({
  isUrgent,
  urgentLevel,
}: {
  isUrgent: boolean;
  urgentLevel: number | null;
}) {
  if (!isUrgent) {
    return <Badge tone="muted">일반</Badge>;
  }

  return <Badge tone="danger">{`긴급 L${urgentLevel ?? 1}`}</Badge>;
}
