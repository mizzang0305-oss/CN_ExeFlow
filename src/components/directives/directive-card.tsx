import Link from "next/link";

import type { DirectiveListItem } from "@/features/directives/types";
import { formatDateLabel, formatRelativeUpdate } from "@/lib/format";

import { Card } from "@/components/ui/card";
import { DirectiveStatusBadge } from "./directive-status-badge";
import { UrgencyBadge } from "./urgency-badge";

function describeTarget(directive: DirectiveListItem) {
  if (directive.targetScope === "ALL") {
    return `전사 대상 · 주관 ${directive.ownerDepartmentName ?? "미지정"}`;
  }

  if (directive.targetDepartmentCount <= 1) {
    return directive.ownerDepartmentName ?? "대상 부서 미지정";
  }

  return `주관 ${directive.ownerDepartmentName ?? "미지정"} · 협업 ${directive.supportDepartmentCount}개 부서`;
}

export function DirectiveCard({ directive }: { directive: DirectiveListItem }) {
  return (
    <Link href={`/directives/${directive.id}`} className="block">
      <Card
        className={
          directive.isUrgent
            ? "border-danger-200 shadow-[0_20px_46px_rgba(220,38,38,0.10)] transition hover:border-danger-300 hover:shadow-[0_24px_52px_rgba(220,38,38,0.14)]"
            : "transition hover:border-brand-200 hover:shadow-[0_24px_52px_rgba(6,18,38,0.12)]"
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
              {describeTarget(directive)}
              {directive.ownerUserName ? ` · 담당 ${directive.ownerUserName}` : ""}
            </p>
          </div>

          <div className="grid gap-3 text-sm text-ink-700 sm:grid-cols-5">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">마감일</p>
              <p className={directive.isDelayed ? "mt-1 font-semibold text-danger-700" : "mt-1"}>
                {formatDateLabel(directive.dueDate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">최근 업데이트</p>
              <p className="mt-1">{formatRelativeUpdate(directive.lastActivityAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">대상 부서</p>
              <p className="mt-1">{directive.targetDepartmentCount}개</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">완료 / 승인 대기</p>
              <p className="mt-1">
                {directive.departmentProgress.COMPLETED} 완료 · {directive.departmentProgress.COMPLETION_REQUESTED} 대기
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">지연 부서</p>
              <p className="mt-1">{directive.departmentProgress.DELAYED}개</p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
