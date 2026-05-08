"use client";

import Link from "next/link";

import type { DepartmentDirectiveItem } from "@/lib/hooks/useDepartmentDirectives";
import {
  getDirectiveStatusLabel,
  URGENT_STATUS_LABEL,
} from "@/lib/constants/status-labels";
import { formatDateLabel } from "@/lib";
import { cn } from "@/lib/utils";

type DirectiveListProps = {
  items: DepartmentDirectiveItem[];
};

function statusClassName(status: string, isUrgent: boolean) {
  if (status === "DELAYED") {
    return "border-danger-700 bg-danger-700 text-white shadow-[0_8px_18px_rgba(185,28,28,0.18)]";
  }

  if (isUrgent) {
    return "border-danger-800 bg-danger-800 text-white shadow-[0_8px_18px_rgba(127,29,29,0.18)]";
  }

  if (status === "COMPLETION_REQUESTED") {
    return "border-warning-300 bg-warning-50 text-warning-800";
  }

  if (status === "COMPLETED") {
    return "border-success-300 bg-success-50 text-success-800";
  }

  if (status === "REJECTED") {
    return "border-ink-300 bg-ink-100 text-ink-800";
  }

  return "border-brand-200 bg-brand-50 text-brand-800";
}

export function DirectiveList({ items }: DirectiveListProps) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-ink-200 bg-white shadow-[0_14px_34px_rgba(6,18,38,0.06)]">
      <div className="min-w-0 divide-y divide-ink-100">
        {items.map((item) => {
          const statusLabel = getDirectiveStatusLabel(item.status);
          const dateLabel = formatDateLabel(item.updated_at ?? item.created_at);
          const departmentName = item.department_name ?? "부서 미지정";
          const urgencyLabel = item.is_urgent ? URGENT_STATUS_LABEL : "일반";
          const isRiskRow = item.status === "DELAYED" || item.is_urgent;

          return (
            <div
              key={item.id}
              className={cn(
                "directive-row group grid min-h-[5.75rem] min-w-0 grid-cols-1 gap-3 overflow-hidden break-words whitespace-normal border-l-4 border-l-transparent px-4 py-4 transition duration-150 hover:border-brand-200 hover:border-l-brand-400 hover:bg-brand-50/65 hover:shadow-[0_14px_28px_rgba(6,18,38,0.08)] md:grid-cols-[minmax(0,1fr)_6.5rem] md:items-center md:gap-4 md:px-5",
                isRiskRow && "border-l-danger-500 bg-danger-50/50 hover:border-l-danger-600 hover:bg-danger-50/70",
              )}
            >
              <div className="directive-main min-w-0">
                <div className="directive-title-line flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-bold leading-none",
                      statusClassName(item.status, item.is_urgent),
                    )}
                  >
                    {statusLabel}
                  </span>
                  <p
                    className="line-clamp-2 min-w-0 text-lg font-semibold leading-snug text-ink-950"
                    title={item.title}
                  >
                    {item.title}
                  </p>
                </div>

                <p className="directive-meta-line mt-2 truncate text-sm font-semibold text-ink-600">
                  {departmentName} · {dateLabel} · {urgencyLabel} · {item.directive_no}
                </p>
              </div>

              <div className="directive-actions flex min-w-0 justify-end">
                <Link
                  href={`/directives/${item.id}`}
                  aria-label={`${item.directive_no} ${item.title} 상세 보기`}
                  className="management-clickable inline-flex min-h-11 w-full items-center justify-center rounded-[14px] border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-900 shadow-[0_8px_18px_rgba(3,19,38,0.08)] transition hover:border-brand-300 hover:bg-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:translate-y-[1px] md:w-auto"
                >
                  상세 보기
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
