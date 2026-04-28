"use client";

import type { KeyboardEvent, MouseEvent } from "react";

import type { DepartmentAnalysisItem } from "@/features/dashboard";
import type { DirectiveStatusValue } from "@/lib/constants/status-labels";
import { cn } from "@/lib/utils";

type DepartmentProgressCardProps = {
  activeStatus: DirectiveStatusValue | null;
  activeUrgent: boolean;
  department: DepartmentAnalysisItem;
  isSelected: boolean;
  onPrefetch: (departmentId: string, status?: DirectiveStatusValue | null, urgent?: boolean) => void;
  onSelect: (departmentId: string) => void;
  onStatusSelect: (departmentId: string, status: DirectiveStatusValue | null, urgent?: boolean) => void;
};

function getRisk(department: DepartmentAnalysisItem) {
  if (department.delayedCount > 0 || department.urgentCount > 0) {
    return {
      className: "border-danger-200 bg-danger-50 text-danger-700",
      label: "위험",
      marker: "!",
    };
  }

  if (department.waitingApprovalCount > 0 || department.completionRate < 50) {
    return {
      className: "border-warning-200 bg-warning-50 text-warning-700",
      label: "주의",
      marker: "·",
    };
  }

  return {
    className: "border-success-200 bg-success-50 text-success-700",
    label: "정상",
    marker: "✓",
  };
}

function chipClass(isActive: boolean, tone: "danger" | "warning") {
  const base =
    "management-clickable inline-flex min-h-11 items-center gap-2 rounded-[16px] border px-3.5 py-2 text-sm font-bold transition";

  if (isActive) {
    return cn(
      base,
      tone === "danger"
        ? "border-danger-600 bg-danger-600 text-white shadow-[0_16px_32px_rgba(220,38,38,0.2)]"
        : "border-warning-600 bg-warning-600 text-white shadow-[0_16px_32px_rgba(217,119,6,0.2)]",
    );
  }

  return cn(
    base,
    tone === "danger"
      ? "border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100"
      : "border-warning-200 bg-warning-50 text-warning-700 hover:bg-warning-100",
  );
}

export function DepartmentProgressCard({
  activeStatus,
  activeUrgent,
  department,
  isSelected,
  onPrefetch,
  onSelect,
  onStatusSelect,
}: DepartmentProgressCardProps) {
  const risk = getRisk(department);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(department.departmentId);
    }
  };

  const handleChipClick = (
    event: MouseEvent<HTMLButtonElement>,
    status: DirectiveStatusValue | null,
    urgent = false,
  ) => {
    event.stopPropagation();
    onStatusSelect(department.departmentId, status, urgent);
  };

  const completionRate = Math.max(0, Math.min(100, department.completionRate));

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${department.departmentName} 해당 부서 지시사항 보기`}
      onClick={() => onSelect(department.departmentId)}
      onKeyDown={handleKeyDown}
      onPointerEnter={() => onPrefetch(department.departmentId)}
      className={cn(
        "executive-click-target group relative min-h-[21rem] rounded-[26px] border bg-white px-5 py-5 shadow-[0_18px_46px_rgba(6,18,38,0.08)] outline-none transition duration-200",
        isSelected
          ? "border-brand-900 ring-4 ring-brand-100"
          : "border-white/80 hover:border-brand-300 hover:bg-brand-50/35",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-bold text-ink-950">{department.departmentName}</h3>
            {isSelected ? (
              <span className="rounded-full bg-brand-900 px-3 py-1 text-xs font-bold text-white">선택됨</span>
            ) : null}
          </div>
          <p className="mt-2 text-base font-semibold text-ink-700">{`총 ${department.totalCount}건`}</p>
        </div>

        <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-bold", risk.className)}>
          <span aria-hidden="true">{risk.marker}</span>
          {risk.label}
        </span>
      </div>

      <div className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-ink-600">완료율</p>
            <p className="mt-1 text-5xl font-bold text-ink-950">{completionRate}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-ink-600">완료</p>
            <p className="mt-1 text-3xl font-bold text-success-700">{department.completedCount}건</p>
          </div>
        </div>

        <div className="mt-5 h-4 overflow-hidden rounded-full bg-ink-100">
          <div
            className="department-progress-bar h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-700),var(--color-success-600))]"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <div className="rounded-[18px] border border-ink-200 bg-ink-50 px-3 py-3">
          <p className="text-xs font-bold text-ink-600">진행중</p>
          <p className="mt-1 text-2xl font-bold text-ink-950">{department.inProgressCount}</p>
        </div>
        <div className="rounded-[18px] border border-success-200 bg-success-50 px-3 py-3">
          <p className="text-xs font-bold text-success-700">완료</p>
          <p className="mt-1 text-2xl font-bold text-success-700">{department.completedCount}</p>
        </div>
        <div className="rounded-[18px] border border-danger-200 bg-danger-50 px-3 py-3">
          <p className="text-xs font-bold text-danger-700">반려</p>
          <p className="mt-1 text-2xl font-bold text-danger-700">{department.rejectedCount}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          aria-label={`${department.departmentName} 승인 대기 지시사항 보기`}
          onClick={(event) => handleChipClick(event, "COMPLETION_REQUESTED")}
          onPointerEnter={(event) => {
            event.stopPropagation();
            onPrefetch(department.departmentId, "COMPLETION_REQUESTED");
          }}
          className={chipClass(isSelected && activeStatus === "COMPLETION_REQUESTED" && !activeUrgent, "warning")}
        >
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-current" />
          승인 대기 {department.waitingApprovalCount}
        </button>
        <button
          type="button"
          aria-label={`${department.departmentName} 지연 지시사항 보기`}
          onClick={(event) => handleChipClick(event, "DELAYED")}
          onPointerEnter={(event) => {
            event.stopPropagation();
            onPrefetch(department.departmentId, "DELAYED");
          }}
          className={chipClass(isSelected && activeStatus === "DELAYED" && !activeUrgent, "danger")}
        >
          <span aria-hidden="true" className="h-3 w-3 rotate-45 bg-current" />
          지연 {department.delayedCount}
        </button>
        <button
          type="button"
          aria-label={`${department.departmentName} 긴급 지시사항 보기`}
          onClick={(event) => handleChipClick(event, null, true)}
          onPointerEnter={(event) => {
            event.stopPropagation();
            onPrefetch(department.departmentId, null, true);
          }}
          className={chipClass(isSelected && activeUrgent, "danger")}
        >
          <span aria-hidden="true" className="font-black">!</span>
          긴급 {department.urgentCount}
        </button>
      </div>

      <span className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 rounded-full bg-brand-900 px-3 py-1.5 text-sm font-bold text-white opacity-0 shadow-[0_14px_30px_rgba(3,19,38,0.24)] transition group-hover:opacity-100 lg:inline-flex">
        열람 →
      </span>
    </div>
  );
}
