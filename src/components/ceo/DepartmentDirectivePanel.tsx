"use client";

import type { DepartmentAnalysisItem } from "@/features/dashboard";
import type { DirectiveStatusValue } from "@/lib/constants/status-labels";
import {
  DIRECTIVE_STATUS_LABELS,
  URGENT_STATUS_LABEL,
} from "@/lib/constants/status-labels";
import type { DepartmentDirectivesResponse } from "@/lib/hooks/useDepartmentDirectives";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

import { DirectiveList } from "./DirectiveList";
import { DirectiveListSkeleton } from "./DirectiveListSkeleton";
import { StatusFilterBar } from "./StatusFilterBar";

type DepartmentDirectivePanelProps = {
  data: DepartmentDirectivesResponse | null;
  department: DepartmentAnalysisItem | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onFilterChange: (status: DirectiveStatusValue | null, urgent: boolean) => void;
  onPageChange: (page: number) => void;
  onRefetch: () => void;
  page: number;
  status: DirectiveStatusValue | null;
  urgent: boolean;
};

function getSubtitle(status: DirectiveStatusValue | null, urgent: boolean) {
  if (urgent) {
    return `${URGENT_STATUS_LABEL} 지시사항만 표시하고 있습니다.`;
  }

  if (status) {
    return `${DIRECTIVE_STATUS_LABELS[status]} 지시사항만 표시하고 있습니다.`;
  }

  return "전체 지시사항을 표시하고 있습니다.";
}

export function DepartmentDirectivePanel({
  data,
  department,
  error,
  isLoading,
  isRefreshing,
  onFilterChange,
  onPageChange,
  onRefetch,
  page,
  status,
  urgent,
}: DepartmentDirectivePanelProps) {
  const departmentName = data?.department.name ?? department?.departmentName ?? "선택한 부서";
  const itemCount = data?.items.length ?? 0;

  return (
    <section className="detail-panel-enter rounded-[30px] border border-brand-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,249,255,0.94))] p-5 shadow-[0_26px_70px_rgba(6,18,38,0.11)] sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-bold text-ink-950">{departmentName} 지시사항</h2>
            {isRefreshing ? (
              <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
                최신 확인 중
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-base font-semibold text-ink-700">{getSubtitle(status, urgent)}</p>
          <p className="mt-1 text-sm font-bold text-ink-600">{`총 표시 ${itemCount}건`}</p>
        </div>

        <StatusFilterBar currentStatus={status} currentUrgent={urgent} onChange={onFilterChange} />
      </div>

      <div className="mt-6">
        {isLoading && !data ? <DirectiveListSkeleton /> : null}

        {error && !isLoading ? (
          <ErrorState
            title="지시사항을 불러오지 못했습니다."
            description="잠시 후 다시 시도해주세요."
            action={
              <Button type="button" variant="secondary" onClick={onRefetch}>
                다시 불러오기
              </Button>
            }
          />
        ) : null}

        {!error && data && data.items.length === 0 ? (
          <EmptyState
            title="표시할 지시사항이 없습니다."
            description="다른 상태를 선택해 확인해보세요."
          />
        ) : null}

        {!error && data && data.items.length > 0 ? <DirectiveList items={data.items} /> : null}
      </div>

      {data ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <p className="text-sm font-semibold text-ink-600">{`${page}쪽`}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              이전
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!data.hasMore || isLoading}
              onClick={() => onPageChange(page + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
