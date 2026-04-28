"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CeoDashboardData, DepartmentAnalysisItem } from "@/features/dashboard";
import type { DirectiveStatusValue } from "@/lib/constants/status-labels";
import {
  normalizeDirectiveStatus,
  normalizeUrgentQueryValue,
} from "@/lib/constants/status-labels";
import { useDepartmentDirectives } from "@/lib/hooks/useDepartmentDirectives";
import { cn } from "@/lib/utils";

import { DepartmentDirectivePanel } from "@/components/ceo/DepartmentDirectivePanel";
import { DepartmentProgressCard } from "@/components/ceo/DepartmentProgressCard";
import { EmptyState } from "@/components/ui/empty-state";

type CeoDashboardClientProps = {
  data: CeoDashboardData;
};

type SummaryCard = {
  accentClassName: string;
  label: string;
  shape: "bar" | "circle" | "diamond" | "ring" | "square" | "warning";
  value: string;
};

function buildSummaryCards(data: CeoDashboardData): SummaryCard[] {
  const summary = data.executiveSummary;

  return [
    {
      accentClassName: "bg-brand-700",
      label: "전체 지시 건수",
      shape: "square",
      value: `${summary.totalCount}`,
    },
    {
      accentClassName: "bg-brand-600",
      label: "진행중",
      shape: "bar",
      value: `${summary.inProgressCount}`,
    },
    {
      accentClassName: "bg-warning-600",
      label: "승인 대기",
      shape: "ring",
      value: `${summary.waitingApprovalCount}`,
    },
    {
      accentClassName: "bg-danger-600",
      label: "지연",
      shape: "diamond",
      value: `${summary.delayedCount}`,
    },
    {
      accentClassName: "bg-danger-700",
      label: "긴급",
      shape: "warning",
      value: `${summary.urgentCount}`,
    },
    {
      accentClassName: "bg-success-600",
      label: "완료율",
      shape: "circle",
      value: `${summary.completionRate}%`,
    },
  ];
}

function SummaryShape({
  className,
  shape,
}: {
  className: string;
  shape: SummaryCard["shape"];
}) {
  if (shape === "diamond") {
    return <span aria-hidden="true" className={cn("h-4 w-4 rotate-45 rounded-[3px]", className)} />;
  }

  if (shape === "ring") {
    return <span aria-hidden="true" className="h-4 w-4 rounded-full border-[5px] border-warning-600 bg-white" />;
  }

  if (shape === "bar") {
    return <span aria-hidden="true" className={cn("h-4 w-7 rounded-full", className)} />;
  }

  if (shape === "warning") {
    return <span aria-hidden="true" className={cn("flex h-6 w-6 items-center justify-center rounded-full text-sm font-black text-white", className)}>!</span>;
  }

  return <span aria-hidden="true" className={cn("h-4 w-4 rounded-full", shape === "square" && "rounded-[4px]", className)} />;
}

function compareRisk(left: DepartmentAnalysisItem, right: DepartmentAnalysisItem) {
  const leftRisk = [
    left.delayedCount > 0 ? 0 : 1,
    left.urgentCount > 0 ? 0 : 1,
    left.waitingApprovalCount > 0 ? 0 : 1,
    left.completionRate,
  ];
  const rightRisk = [
    right.delayedCount > 0 ? 0 : 1,
    right.urgentCount > 0 ? 0 : 1,
    right.waitingApprovalCount > 0 ? 0 : 1,
    right.completionRate,
  ];

  for (let index = 0; index < leftRisk.length; index += 1) {
    if (leftRisk[index] !== rightRisk[index]) {
      return leftRisk[index] - rightRisk[index];
    }
  }

  return right.totalCount - left.totalCount;
}

export function CeoDashboardClient({ data }: CeoDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(() =>
    searchParams.get("departmentId"),
  );
  const [selectedStatus, setSelectedStatus] = useState<DirectiveStatusValue | null>(() =>
    normalizeDirectiveStatus(searchParams.get("status")),
  );
  const [urgentOnly, setUrgentOnly] = useState(() =>
    normalizeUrgentQueryValue(searchParams.get("urgent")),
  );
  const [page, setPage] = useState(1);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  const selectedDepartment = useMemo(
    () => data.departments.find((department) => department.departmentId === selectedDepartmentId) ?? null,
    [data.departments, selectedDepartmentId],
  );
  const summaryCards = useMemo(() => buildSummaryCards(data), [data]);

  const {
    data: directivesData,
    error: directivesError,
    isLoading: directivesLoading,
    isRefreshing: directivesRefreshing,
    prefetch,
    refetch,
  } = useDepartmentDirectives({
    departmentId: selectedDepartmentId,
    limit: 50,
    page,
    status: selectedStatus,
    urgent: urgentOnly,
  });

  const updateUrl = useCallback(
    (departmentId: string | null, status: DirectiveStatusValue | null, urgent: boolean) => {
      const nextParams = new URLSearchParams();

      if (departmentId) {
        nextParams.set("departmentId", departmentId);
      }

      if (status) {
        nextParams.set("status", status);
      }

      if (urgent) {
        nextParams.set("urgent", "true");
      }

      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const selectDepartment = useCallback(
    (departmentId: string) => {
      setSelectedDepartmentId(departmentId);
      setSelectedStatus(null);
      setUrgentOnly(false);
      setPage(1);
      updateUrl(departmentId, null, false);
    },
    [updateUrl],
  );

  const selectStatus = useCallback(
    (departmentId: string, status: DirectiveStatusValue | null, urgent = false) => {
      setSelectedDepartmentId(departmentId);
      setSelectedStatus(urgent ? null : status);
      setUrgentOnly(urgent);
      setPage(1);
      updateUrl(departmentId, urgent ? null : status, urgent);
    },
    [updateUrl],
  );

  const prefetchDepartment = useCallback(
    (departmentId: string, status?: DirectiveStatusValue | null, urgent = false) => {
      void prefetch({
        departmentId,
        limit: 50,
        page: 1,
        status: urgent ? null : status ?? null,
        urgent,
      });
    },
    [prefetch],
  );

  useEffect(() => {
    const departmentId = searchParams.get("departmentId");
    const status = normalizeDirectiveStatus(searchParams.get("status"));
    const urgent = normalizeUrgentQueryValue(searchParams.get("urgent"));
    const timer = window.setTimeout(() => {
      setSelectedDepartmentId(departmentId);
      setSelectedStatus(urgent ? null : status);
      setUrgentOnly(urgent);
      setPage(1);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    const targets = [...data.departments].sort(compareRisk).slice(0, 3);

    const timer = window.setTimeout(() => {
      for (const department of targets) {
        void prefetch({
          departmentId: department.departmentId,
          limit: 50,
          page: 1,
          status: null,
          urgent: false,
        });
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [data.departments, prefetch]);

  useEffect(() => {
    if (!selectedDepartmentId) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [selectedDepartmentId, selectedStatus, urgentOnly]);

  return (
    <div className="space-y-7">
      <section aria-label="상단 요약 영역" className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[24px] border border-white/80 bg-white px-5 py-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-bold text-ink-700">{card.label}</p>
              <SummaryShape className={card.accentClassName} shape={card.shape} />
            </div>
            <p className="mt-4 text-5xl font-bold text-ink-950">{card.value}</p>
          </div>
        ))}
      </section>

      <section aria-label="부서 현황" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-ink-950">부서 현황</h2>
            <p className="mt-1 text-base font-semibold text-ink-700">
              부서를 누르면 오른쪽 확인창에서 지시사항이 바로 열립니다.
            </p>
          </div>
          <p className="text-sm font-bold text-ink-600">카드와 상태 영역을 선택할 수 있습니다.</p>
        </div>

        {data.departments.length === 0 ? (
          <EmptyState
            title="부서 현황이 없습니다."
            description="지시사항이 등록되면 부서별 실행 현황이 여기에 표시됩니다."
          />
        ) : (
          <div
            className={cn(
              selectedDepartmentId
                ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(390px,480px)] 2xl:grid-cols-[minmax(0,1.25fr)_minmax(460px,560px)]"
                : "grid gap-5",
            )}
          >
            <div
              className={cn(
                "grid gap-4",
                selectedDepartmentId ? "xl:grid-cols-1 2xl:grid-cols-2" : "xl:grid-cols-2 2xl:grid-cols-3",
              )}
            >
              {data.departments.map((department) => (
                <DepartmentProgressCard
                  key={department.departmentId}
                  activeStatus={selectedStatus}
                  activeUrgent={urgentOnly}
                  department={department}
                  isSelected={selectedDepartmentId === department.departmentId}
                  onPrefetch={prefetchDepartment}
                  onSelect={selectDepartment}
                  onStatusSelect={selectStatus}
                />
              ))}
            </div>

            {selectedDepartmentId ? (
              <div ref={detailPanelRef} className="min-w-0 lg:sticky lg:top-4 lg:self-start">
                <DepartmentDirectivePanel
                  data={directivesData}
                  department={selectedDepartment}
                  error={directivesError}
                  isLoading={directivesLoading}
                  isRefreshing={directivesRefreshing}
                  onFilterChange={(status, urgent) => {
                    if (!selectedDepartmentId) {
                      return;
                    }

                    selectStatus(selectedDepartmentId, status, urgent);
                  }}
                  onPageChange={(nextPage) => setPage(nextPage)}
                  onRefetch={() => {
                    void refetch();
                  }}
                  page={page}
                  status={selectedStatus}
                  urgent={urgentOnly}
                />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
