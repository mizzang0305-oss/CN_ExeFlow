"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  ariaLabel: string;
  label: string;
  shape: "bar" | "circle" | "diamond" | "ring" | "square" | "warning";
  status: DirectiveStatusValue | null;
  urgent: boolean;
  value: string;
};

function buildSummaryCards(data: CeoDashboardData): SummaryCard[] {
  const summary = data.executiveSummary;

  return [
    {
      accentClassName: "bg-brand-700",
      ariaLabel: "전체 지시사항 보기",
      label: "전체 지시 건수",
      shape: "square",
      status: null,
      urgent: false,
      value: `${summary.totalCount}`,
    },
    {
      accentClassName: "bg-brand-600",
      ariaLabel: "전체 진행중 지시사항 보기",
      label: "진행중",
      shape: "bar",
      status: "IN_PROGRESS",
      urgent: false,
      value: `${summary.inProgressCount}`,
    },
    {
      accentClassName: "bg-warning-600",
      ariaLabel: "전체 승인 대기 지시사항 보기",
      label: "승인 대기",
      shape: "ring",
      status: "COMPLETION_REQUESTED",
      urgent: false,
      value: `${summary.waitingApprovalCount}`,
    },
    {
      accentClassName: "bg-danger-600",
      ariaLabel: "전체 지연 지시사항 보기",
      label: "지연",
      shape: "diamond",
      status: "DELAYED",
      urgent: false,
      value: `${summary.delayedCount}`,
    },
    {
      accentClassName: "bg-danger-700",
      ariaLabel: "전체 긴급 지시사항 보기",
      label: "긴급",
      shape: "warning",
      status: null,
      urgent: true,
      value: `${summary.urgentCount}`,
    },
    {
      accentClassName: "bg-success-600",
      ariaLabel: "전체 완료 지시사항 보기",
      label: "완료율",
      shape: "circle",
      status: "COMPLETED",
      urgent: false,
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

type SelectedScope = "none" | "global" | "department";

type UrlSelection = {
  departmentId: string | null;
  scope: SelectedScope;
  status: DirectiveStatusValue | null;
  urgent: boolean;
};

function readSelectionFromUrl(): UrlSelection {
  if (typeof window === "undefined") {
    return {
      departmentId: null,
      scope: "none",
      status: null,
      urgent: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const urgent = normalizeUrgentQueryValue(params.get("urgent"));
  const departmentId = params.get("departmentId");
  const scope = params.get("scope") === "global"
    ? "global"
    : departmentId
      ? "department"
      : "none";

  return {
    departmentId: scope === "department" ? departmentId : null,
    scope,
    status: urgent ? null : normalizeDirectiveStatus(params.get("status")),
    urgent,
  };
}

function replaceUrlSilently({
  departmentId,
  scope,
  status,
  urgent,
}: {
  departmentId: string | null;
  scope: SelectedScope;
  status: DirectiveStatusValue | null;
  urgent: boolean;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams();

  if (scope === "global") {
    params.set("scope", "global");
  }

  if (departmentId) {
    params.set("departmentId", departmentId);
  }

  if (status) {
    params.set("status", status);
  }

  if (urgent) {
    params.set("urgent", "true");
  }

  const nextQuery = params.toString();
  const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
  window.history.replaceState(null, "", nextUrl);
}

export function CeoDashboardClient({ data }: CeoDashboardClientProps) {
  const [selectedScope, setSelectedScope] = useState<SelectedScope>("none");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DirectiveStatusValue | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [page, setPage] = useState(1);
  const detailPanelRef = useRef<HTMLElement | null>(null);

  const selectedDepartment = useMemo(
    () => data.departments.find((department) => department.departmentId === selectedDepartmentId) ?? null,
    [data.departments, selectedDepartmentId],
  );
  const summaryCards = useMemo(() => buildSummaryCards(data), [data]);
  const shouldShowPanel = selectedScope !== "none";

  const {
    data: directivesData,
    error: directivesError,
    isLoading: directivesLoading,
    isRefreshing: directivesRefreshing,
    prefetch,
    refetch,
  } = useDepartmentDirectives({
    departmentId: selectedScope === "department" ? selectedDepartmentId : null,
    limit: 50,
    page,
    scope: selectedScope,
    status: selectedStatus,
    urgent: urgentOnly,
  });

  const selectDepartment = useCallback(
    (departmentId: string) => {
      setSelectedScope("department");
      setSelectedDepartmentId(departmentId);
      setSelectedStatus(null);
      setUrgentOnly(false);
      setPage(1);
      replaceUrlSilently({
        departmentId,
        scope: "department",
        status: null,
        urgent: false,
      });
    },
    [],
  );

  const selectDepartmentStatus = useCallback(
    (departmentId: string, status: DirectiveStatusValue | null, urgent = false) => {
      setSelectedScope("department");
      setSelectedDepartmentId(departmentId);
      setSelectedStatus(urgent ? null : status);
      setUrgentOnly(urgent);
      setPage(1);
      replaceUrlSilently({
        departmentId,
        scope: "department",
        status: urgent ? null : status,
        urgent,
      });
    },
    [],
  );

  const selectGlobalStatus = useCallback((status: DirectiveStatusValue | null, urgent = false) => {
    setSelectedScope("global");
    setSelectedDepartmentId(null);
    setSelectedStatus(urgent ? null : status);
    setUrgentOnly(urgent);
    setPage(1);
    replaceUrlSilently({
      departmentId: null,
      scope: "global",
      status: urgent ? null : status,
      urgent,
    });
  }, []);

  const closeInspectorPanel = useCallback(() => {
    setSelectedScope("none");
    setSelectedDepartmentId(null);
    setSelectedStatus(null);
    setUrgentOnly(false);
    setPage(1);
    replaceUrlSilently({
      departmentId: null,
      scope: "none",
      status: null,
      urgent: false,
    });
  }, []);

  const prefetchDepartment = useCallback(
    (departmentId: string, status?: DirectiveStatusValue | null, urgent = false) => {
      void prefetch({
        departmentId,
        limit: 50,
        page: 1,
        scope: "department",
        status: urgent ? null : status ?? null,
        urgent,
      });
    },
    [prefetch],
  );

  const prefetchGlobalStatus = useCallback(
    (status: DirectiveStatusValue | null, urgent = false) => {
      void prefetch({
        departmentId: null,
        limit: 50,
        page: 1,
        scope: "global",
        status: urgent ? null : status,
        urgent,
      });
    },
    [prefetch],
  );

  useEffect(() => {
    const applyUrlSelection = () => {
      const { departmentId, scope, status, urgent } = readSelectionFromUrl();

      setSelectedScope(scope);
      setSelectedDepartmentId(departmentId);
      setSelectedStatus(status);
      setUrgentOnly(urgent);
      setPage(1);
    };

    applyUrlSelection();
    window.addEventListener("popstate", applyUrlSelection);

    return () => window.removeEventListener("popstate", applyUrlSelection);
  }, []);

  useEffect(() => {
    const targets = [...data.departments].sort(compareRisk).slice(0, 3);

    const timer = window.setTimeout(() => {
      for (const department of targets) {
        void prefetch({
          departmentId: department.departmentId,
          limit: 50,
          page: 1,
          scope: "department",
          status: null,
          urgent: false,
        });
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [data.departments, prefetch]);

  useEffect(() => {
    if (!shouldShowPanel) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [shouldShowPanel, selectedDepartmentId, selectedStatus, urgentOnly]);

  return (
    <div className="space-y-7">
      <section aria-label="상단 요약 영역" className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => {
          const isActive = selectedScope === "global" && selectedStatus === card.status && urgentOnly === card.urgent;

          return (
            <button
              key={card.label}
              type="button"
              aria-label={card.ariaLabel}
              aria-pressed={isActive}
              onClick={() => selectGlobalStatus(card.status, card.urgent)}
              onPointerEnter={() => prefetchGlobalStatus(card.status, card.urgent)}
              className={cn(
                "executive-click-target rounded-[24px] border border-white/80 bg-white px-5 py-5 text-left shadow-[0_18px_42px_rgba(6,18,38,0.08)]",
                isActive && "border-brand-900 bg-brand-50 ring-4 ring-brand-100",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-ink-700">{card.label}</p>
                  {isActive ? (
                    <span className="mt-2 inline-flex rounded-full bg-brand-900 px-3 py-1 text-xs font-bold text-white">
                      선택됨
                    </span>
                  ) : null}
                </div>
                <SummaryShape className={card.accentClassName} shape={card.shape} />
              </div>
              <p className="mt-4 text-5xl font-bold text-ink-950">{card.value}</p>
            </button>
          );
        })}
      </section>

      <section
        aria-label="부서 현황"
        className={cn("space-y-4", shouldShowPanel && "lg:pr-[590px] 2xl:pr-[640px]")}
      >
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
          <div className="grid gap-5">
            <div
              className={cn(
                "grid gap-4",
                shouldShowPanel ? "md:grid-cols-2 xl:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3",
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
                  onStatusSelect={selectDepartmentStatus}
                />
              ))}
            </div>

            {shouldShowPanel ? (
              <aside
                ref={detailPanelRef}
                aria-label="지시사항 확인창"
                className="z-40 min-w-0 lg:fixed lg:right-6 lg:top-6 lg:bottom-6 lg:w-[520px] xl:w-[560px] 2xl:w-[600px]"
              >
                <DepartmentDirectivePanel
                  data={directivesData}
                  department={selectedDepartment}
                  error={directivesError}
                  isLoading={directivesLoading}
                  isRefreshing={directivesRefreshing}
                  mode={selectedScope === "global" ? "global" : "department"}
                  onFilterChange={(status, urgent) => {
                    if (selectedScope === "global") {
                      selectGlobalStatus(status, urgent);
                    } else if (selectedDepartmentId) {
                      selectDepartmentStatus(selectedDepartmentId, status, urgent);
                    }
                  }}
                  onPageChange={(nextPage) => setPage(nextPage)}
                  onClose={closeInspectorPanel}
                  onRefetch={() => {
                    void refetch();
                  }}
                  page={page}
                  status={selectedStatus}
                  urgent={urgentOnly}
                />
              </aside>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
