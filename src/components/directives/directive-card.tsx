import Link from "next/link";

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
            <h2 className="text-lg font-semibold tracking-tight text-ink-950">{directive.title}</h2>
            <p className="text-sm text-ink-700">
              {directive.ownerDepartmentName ?? "미지정 부서"}
              {directive.ownerUserName ? ` · ${directive.ownerUserName}` : ""}
            </p>
          </div>

          <div className="grid gap-3 text-sm text-ink-700 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">마감일</p>
              <p className={directive.isDelayed ? "mt-1 font-semibold text-danger-700" : "mt-1"}>
                {formatDateLabel(directive.dueDate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">최근 업데이트</p>
              <p className="mt-1">{formatRelativeUpdate(directive.lastActivityAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">실행 로그</p>
              <p className="mt-1">{directive.logCount}건</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">증빙</p>
              <p className="mt-1">{directive.attachmentCount}건</p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
