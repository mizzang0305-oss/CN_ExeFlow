"use client";

import Link from "next/link";

import type { DepartmentDirectiveItem } from "@/lib/hooks/useDepartmentDirectives";
import {
  getDirectiveStatusLabel,
  URGENT_STATUS_LABEL,
} from "@/lib/constants/status-labels";
import { formatDateTimeLabel } from "@/lib";
import { cn } from "@/lib/utils";

type DirectiveListProps = {
  items: DepartmentDirectiveItem[];
};

function statusClassName(status: string, isUrgent: boolean) {
  if (status === "DELAYED" || isUrgent) {
    return "border-danger-200 bg-danger-50 text-danger-700";
  }

  if (status === "COMPLETION_REQUESTED") {
    return "border-warning-200 bg-warning-50 text-warning-700";
  }

  if (status === "COMPLETED") {
    return "border-success-200 bg-success-50 text-success-700";
  }

  if (status === "REJECTED") {
    return "border-ink-300 bg-ink-100 text-ink-800";
  }

  return "border-brand-100 bg-brand-50 text-brand-700";
}

export function DirectiveList({ items }: DirectiveListProps) {
  return (
    <div className="overflow-x-auto rounded-[22px] border border-ink-200 bg-white shadow-[0_14px_34px_rgba(6,18,38,0.06)]">
      <div className="min-w-[64rem]">
        <div className="hidden grid-cols-[8rem_4.5rem_minmax(22rem,1fr)_7rem_7.5rem_4.75rem_5.25rem] gap-2 border-b border-ink-100 bg-ink-50 px-3 py-2 text-[12px] font-bold text-ink-700 md:grid">
          <span className="whitespace-nowrap">관리번호</span>
          <span className="whitespace-nowrap">상태</span>
          <span className="whitespace-nowrap">제목</span>
          <span className="whitespace-nowrap">부서</span>
          <span className="whitespace-nowrap">기준일</span>
          <span className="whitespace-nowrap">긴급</span>
          <span className="whitespace-nowrap text-center">상세</span>
        </div>

        <div className="divide-y divide-ink-100">
          {items.map((item) => {
            const statusLabel = getDirectiveStatusLabel(item.status);
            const dateLabel = formatDateTimeLabel(item.updated_at ?? item.created_at);
            const isRiskRow = item.status === "DELAYED" || item.is_urgent;

            return (
              <div
                key={item.id}
                className={cn(
                  "grid min-h-12 gap-2 px-3 py-3 transition hover:bg-brand-50/70 md:grid-cols-[8rem_4.5rem_minmax(22rem,1fr)_7rem_7.5rem_4.75rem_5.25rem] md:items-center",
                  isRiskRow && "bg-danger-50/45",
                )}
              >
                <div>
                  <p className="text-xs font-bold text-ink-600 md:hidden">관리번호</p>
                  <p className="truncate text-base font-bold text-ink-950">{item.directive_no}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-ink-600 md:hidden">상태</p>
                  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", statusClassName(item.status, item.is_urgent))}>
                    {statusLabel}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink-600 md:hidden">지시 제목</p>
                  <p className="truncate text-base font-bold leading-snug text-ink-950" title={item.title}>
                    {item.title}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-ink-600 md:hidden">부서</p>
                  <span className="block truncate text-sm font-bold text-ink-800">{item.department_name ?? "-"}</span>
                </div>

                <div>
                  <p className="text-xs font-bold text-ink-600 md:hidden">기준일</p>
                  <span className="block truncate text-sm font-semibold text-ink-800">{dateLabel}</span>
                </div>

                <div>
                  <p className="text-xs font-bold text-ink-600 md:hidden">긴급</p>
                  {item.is_urgent ? (
                    <span className="inline-flex rounded-full border border-danger-200 bg-danger-50 px-2.5 py-1 text-xs font-bold text-danger-700">
                      {URGENT_STATUS_LABEL}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-bold text-ink-600">
                      일반
                    </span>
                  )}
                </div>

                <Link
                  href={`/directives/${item.id}`}
                  aria-label={`${item.directive_no} 상세 보기`}
                  className="management-clickable inline-flex min-h-11 items-center justify-center rounded-[14px] border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-900 shadow-[0_8px_18px_rgba(3,19,38,0.08)] transition hover:bg-white"
                >
                  상세
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
