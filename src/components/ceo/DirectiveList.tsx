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

  return "border-brand-100 bg-brand-50 text-brand-700";
}

export function DirectiveList({ items }: DirectiveListProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const statusLabel = getDirectiveStatusLabel(item.status);
        const dateLabel = formatDateTimeLabel(item.updated_at ?? item.created_at);

        return (
          <article
            key={item.id}
            className={cn(
              "rounded-[24px] border bg-white px-4 py-4 shadow-[0_14px_34px_rgba(6,18,38,0.06)] transition sm:px-5",
              item.status === "DELAYED" || item.is_urgent
                ? "border-danger-200"
                : "border-ink-200/90",
            )}
          >
            <div className="grid gap-4 lg:grid-cols-[8.5rem_1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-bold text-ink-600">CN 번호</p>
                <p className="mt-1 text-lg font-bold text-ink-950">{item.directive_no}</p>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-bold", statusClassName(item.status, item.is_urgent))}>
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-current" />
                    {statusLabel}
                  </span>
                  {item.is_urgent ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-danger-200 bg-danger-50 px-3 py-1.5 text-sm font-bold text-danger-700">
                      <span aria-hidden="true">!</span>
                      {URGENT_STATUS_LABEL}
                    </span>
                  ) : null}
                </div>
                <h4 className="mt-3 text-xl font-bold leading-7 text-ink-950">{item.title}</h4>
                <p className="mt-2 text-sm font-semibold text-ink-600">{`최근 기준 ${dateLabel}`}</p>
              </div>

              <Link
                href={`/directives/${item.id}`}
                aria-label={`${item.directive_no} 상세 보기`}
                className="management-clickable inline-flex min-h-11 items-center justify-center rounded-[18px] border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-900 shadow-[0_12px_24px_rgba(3,19,38,0.08)] transition hover:bg-white"
              >
                상세 보기
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
