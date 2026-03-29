import { directiveUrgentLevelLabels, type DirectiveUrgentLevel } from "@/features/directives";

import { Badge } from "@/components/ui/badge";

export function UrgencyBadge({
  isUrgent,
  urgentLevel,
}: {
  isUrgent: boolean;
  urgentLevel: DirectiveUrgentLevel | null;
}) {
  if (!isUrgent) {
    return <Badge tone="muted">일반</Badge>;
  }

  const label = urgentLevel ? directiveUrgentLevelLabels[urgentLevel] : null;

  return <Badge tone="danger">{label ? `긴급 ${label}` : "긴급"}</Badge>;
}
