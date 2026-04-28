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
  mode: "global" | "department";
  onClose: () => void;
  onFilterChange: (status: DirectiveStatusValue | null, urgent: boolean) => void;
  onPageChange: (page: number) => void;
  onRefetch: () => void;
  page: number;
  status: DirectiveStatusValue | null;
  urgent: boolean;
};

const GLOBAL_TITLE: Record<DirectiveStatusValue, string> = {
  COMPLETED: "전체 완료 지시사항",
  COMPLETION_REQUESTED: "전체 승인 대기 지시사항",
  DELAYED: "전체 지연 지시사항",
  IN_PROGRESS: "전체 진행중 지시사항",
  NEW: "전체 신규 지시사항",
  REJECTED: "전체 반려 지시사항",
};

const GLOBAL_SUBTITLE: Record<DirectiveStatusValue, string> = {
  COMPLETED: "전체 완료 지시사항을 표시하고 있습니다.",
  COMPLETION_REQUESTED: "전체 승인 대기 지시사항을 표시하고 있습니다.",
  DELAYED: "전체 지연 지시사항을 표시하고 있습니다.",
  IN_PROGRESS: "전체 진행중 지시사항을 표시하고 있습니다.",
  NEW: "전체 신규 지시사항을 표시하고 있습니다.",
  REJECTED: "전체 반려 지시사항을 표시하고 있습니다.",
};

const DEPARTMENT_SUBTITLE: Record<DirectiveStatusValue, string> = {
  COMPLETED: "해당 부서의 완료 지시사항만 표시하고 있습니다.",
  COMPLETION_REQUESTED: "해당 부서의 승인 대기 지시사항만 표시하고 있습니다.",
  DELAYED: "해당 부서의 지연 지시사항만 표시하고 있습니다.",
  IN_PROGRESS: "해당 부서의 진행중 지시사항만 표시하고 있습니다.",
  NEW: "해당 부서의 신규 지시사항만 표시하고 있습니다.",
  REJECTED: "해당 부서의 반려 지시사항만 표시하고 있습니다.",
};

function getTitle({
  departmentName,
  mode,
  status,
  urgent,
}: {
  departmentName: string;
  mode: "global" | "department";
  status: DirectiveStatusValue | null;
  urgent: boolean;
}) {
  if (mode === "department") {
    return `${departmentName} 지시사항`;
  }

  if (urgent) {
    return "전체 긴급 지시사항";
  }

  if (status) {
    return GLOBAL_TITLE[status];
  }

  return "전체 지시사항";
}

function getSubtitle(mode: "global" | "department", status: DirectiveStatusValue | null, urgent: boolean) {
  if (urgent) {
    return mode === "global"
      ? "전체 긴급 지시사항을 표시하고 있습니다."
      : "해당 부서의 긴급 지시사항만 표시하고 있습니다.";
  }

  if (status) {
    return mode === "global" ? GLOBAL_SUBTITLE[status] : DEPARTMENT_SUBTITLE[status];
  }

  return mode === "global"
    ? "전체 지시사항을 표시하고 있습니다."
    : "해당 부서의 전체 지시사항을 표시하고 있습니다.";
}

export function DepartmentDirectivePanel({
  data,
  department,
  error,
  isLoading,
  isRefreshing,
  mode,
  onClose,
  onFilterChange,
  onPageChange,
  onRefetch,
  page,
  status,
  urgent,
}: DepartmentDirectivePanelProps) {
  const departmentName = mode === "department"
    ? department?.departmentName ?? data?.department.name ?? "선택한 부서"
    : data?.department.name ?? "전체";
  const title = getTitle({ departmentName, mode, status, urgent });
  const itemCount = data?.items.length ?? 0;
  const showLoadingStrip = isLoading || isRefreshing;
  const showBlockingError = Boolean(error && !data && !isLoading);
  const totalText = data ? `총 표시 ${itemCount}건` : error ? "총 표시 확인 불가" : "총 표시 확인 중";

  return (
    <section className="detail-panel-enter flex h-full scroll-mt-4 flex-col rounded-[30px] border border-brand-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,249,255,0.94))] p-5 shadow-[0_26px_70px_rgba(6,18,38,0.18)] sm:p-6">
      <div className="flex shrink-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-ink-950">{title}</h2>
          <p className="mt-2 text-base font-semibold text-ink-700">{getSubtitle(mode, status, urgent)}</p>
          <p className="mt-2 text-sm font-bold text-ink-600">{totalText}</p>
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

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
        {isLoading && !data ? <DirectiveListSkeleton /> : null}

        {showBlockingError ? (
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

        {!showBlockingError && data && data.items.length === 0 ? (
          <EmptyState
            title="표시할 지시사항이 없습니다."
            description="다른 상태를 선택해 확인해보세요."
          />
        ) : null}

        {!showBlockingError && data && data.items.length > 0 ? <DirectiveList items={data.items} /> : null}
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
