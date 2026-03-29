import { directiveStatusLabels } from "@/features/directives/constants";
import type { DirectiveStatus } from "@/features/directives/types";

import { Badge } from "@/components/ui/badge";

const statusToneMap: Record<
  DirectiveStatus,
  "danger" | "default" | "muted" | "success" | "warning"
> = {
  NEW: "muted",
  IN_PROGRESS: "default",
  COMPLETION_REQUESTED: "warning",
  DELAYED: "danger",
  COMPLETED: "success",
  REJECTED: "danger",
};

export function DirectiveStatusBadge({ status }: { status: DirectiveStatus }) {
  return <Badge tone={statusToneMap[status]}>{directiveStatusLabels[status]}</Badge>;
}
