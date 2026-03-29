import Link from "next/link";

import { directivePriorityLabels } from "@/features/directives/constants";
import type { DirectiveListItem } from "@/features/directives/types";
import { formatDateLabel, formatRelativeUpdate } from "@/lib/format";

import { Card } from "@/components/ui/card";
import { DirectiveStatusBadge } from "./directive-status-badge";
import { UrgencyBadge } from "./urgency-badge";

export function DirectiveCard({ directive }: { directive: DirectiveListItem }) {
  return (
    <Link href={`/directives/${directive.id}`} className="block">
      <Card
        className={
          directive.isUrgent
            ? "border-danger-200 shadow-[0_20px_46px_rgba(220,38,38,0.10)] transition hover:-translate-y-0.5"
            : "transition hover:-translate-y-0.5"
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <UrgencyBadge isUrgent={directive.isUrgent} urgentLevel={directive.urgentLevel} />
            <DirectiveStatusBadge status={directive.status} />
            <span className="text-xs font-semibold text-ink-500">{directive.directiveNo}</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-ink-950">
              {directive.title}
            </h2>
            <p className="text-sm text-ink-700">
              {directive.ownerDepartmentName ?? "미지정 부서"}
            </p>
          </div>

          <div className="grid gap-2 text-sm text-ink-700 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">마감일</p>
              <p className={directive.isDelayed ? "mt-1 font-semibold text-warning-700" : "mt-1"}>
                {formatDateLabel(directive.dueDate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">우선순위</p>
              <p className="mt-1">{directivePriorityLabels[directive.priority]}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">최근 상태</p>
              <p className="mt-1">{formatRelativeUpdate(directive.updatedAt)}</p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
