import { directiveStatusLabels } from "@/features/directives/constants";
import type { DirectiveStatus } from "@/features/directives/types";

import { Badge } from "@/components/ui/badge";

const statusToneMap: Record<
  DirectiveStatus,
  "danger" | "default" | "muted" | "success" | "warning"
> = {
  COMPLETED: "success",
  COMPLETION_REQUESTED: "default",
  DELAYED: "warning",
  IN_PROGRESS: "muted",
  NEW: "default",
  REJECTED: "danger",
};

export function DirectiveStatusBadge({ status }: { status: DirectiveStatus }) {
  return <Badge tone={statusToneMap[status]}>{directiveStatusLabels[status]}</Badge>;
}
