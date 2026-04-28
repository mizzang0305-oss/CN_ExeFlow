"use client";

import type { DepartmentAnalysisItem } from "@/features/dashboard";
import type { DirectiveStatusValue } from "@/lib/constants/status-labels";
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

const STATUS_SUBTITLE: Record<DirectiveStatusValue, string> = {
  COMPLETED: "완료 지시사항만 표시하고 있습니다.",
  COMPLETION_REQUESTED: "승인 대기 지시사항만 표시하고 있습니다.",
  DELAYED: "지연 지시사항만 표시하고 있습니다.",
  IN_PROGRESS: "진행중 지시사항만 표시하고 있습니다.",
  NEW: "신규 지시사항만 표시하고 있습니다.",
  REJECTED: "반려 지시사항만 표시하고 있습니다.",
};

function getSubtitle(status: DirectiveStatusValue | null, urgent: boolean) {
  if (urgent) {
    return "긴급 지시사항만 표시하고 있습니다.";
  }

  if (status) {
    return STATUS_SUBTITLE[status];
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
  const showLoadingStrip = isLoading || isRefreshing;

  return (
    <section className="detail-panel-enter scroll-mt-4 rounded-[30px] border border-brand-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,249,255,0.94))] p-5 shadow-[0_26px_70px_rgba(6,18,38,0.11)] sm:p-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
            우측 확인창
          </span>
          {isRefreshing ? (
            <span className="rounded-full border border-success-100 bg-success-50 px-3 py-1 text-sm font-bold text-success-700">
              최신 확인 중
            </span>
          ) : null}
        </div>

        <div>
          <h2 className="text-3xl font-bold text-ink-950">{departmentName} 지시사항</h2>
          <p className="mt-2 text-base font-semibold text-ink-700">{getSubtitle(status, urgent)}</p>
          <p className="mt-2 text-sm font-bold text-ink-600">{`총 표시 ${itemCount}건`}</p>
        </div>

        <StatusFilterBar currentStatus={status} currentUrgent={urgent} onChange={onFilterChange} />
      </div>

      {showLoadingStrip ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-[22px] border border-brand-100 bg-white/82 px-4 py-3 shadow-[0_14px_34px_rgba(6,18,38,0.07)]"
        >
          <div className="flex items-center gap-3">
            <span className="cn-loading-ring h-6 w-6 rounded-full border border-brand-200" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-950">지시사항을 불러오는 중입니다</p>
              <p className="text-xs font-semibold text-ink-600">화면은 그대로 유지됩니다</p>
            </div>
          </div>
          <div className="loading-bar mt-3 h-2 overflow-hidden rounded-full bg-brand-50">
            <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,var(--color-brand-600),var(--color-success-500))]" />
          </div>
        </div>
      ) : null}

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
