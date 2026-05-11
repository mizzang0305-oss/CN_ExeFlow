"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CeoDashboardData, DepartmentAnalysisItem } from "@/features/dashboard";
import {
  filterCeoReportDirectiveItems,
  type CeoReportBucket,
  type CeoReportDirectiveItem,
  type CeoReportDrilldownFilter,
  type CeoReportSourceLabel,
} from "@/features/dashboard/ceo-report";
import type { DirectiveStatusValue } from "@/lib/constants/status-labels";
import {
  normalizeDirectiveStatus,
  normalizeUrgentQueryValue,
} from "@/lib/constants/status-labels";
import { useDepartmentDirectives } from "@/lib/hooks/useDepartmentDirectives";
import { cn } from "@/lib/utils";

import { useStoredImpersonationState } from "@/components/app/impersonation-switcher";
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

type AnalysisModalType = "completion" | "ranking" | "risk" | "urgent";

const analysisCardClassName =
  "min-w-0 overflow-hidden break-words whitespace-normal rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]";

const analysisActionClassName =
  "management-clickable inline-flex min-h-11 items-center justify-center rounded-[16px] border border-brand-100 bg-brand-50 px-4 py-2 text-base font-bold text-brand-900 shadow-[0_10px_24px_rgba(6,18,38,0.08)] transition hover:border-brand-300 hover:bg-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-300 active:translate-y-[1px]";

const dangerActionClassName =
  "management-clickable inline-flex min-h-11 items-center justify-center rounded-[16px] border border-danger-200 bg-danger-50 px-4 py-2 text-base font-bold text-danger-700 shadow-[0_10px_24px_rgba(220,38,38,0.08)] transition hover:border-danger-300 hover:bg-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-danger-200 active:translate-y-[1px]";

const reportMetricButtonClassName =
  "management-clickable rounded-[3px] transition hover:bg-white/65 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-300 active:translate-y-[1px]";

function getReportBlockCount(rate: number) {
  return Math.max(0, Math.min(10, Math.round(rate / 10)));
}

function ReportRateBlocks({ rate }: { rate: number }) {
  const filledBlocks = getReportBlockCount(rate);

  return (
    <div className="flex shrink-0 gap-[5px]" aria-label={`이행률 ${rate}%`}>
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            "h-4 w-3.5 rounded-[1px] sm:w-4 lg:w-5",
            index < filledBlocks ? "bg-[#2F6F2A]" : "bg-[#D5DEE8]",
          )}
        />
      ))}
    </div>
  );
}

function ReportMetricButton({
  ariaLabel,
  children,
  className,
  onClick,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(reportMetricButtonClassName, className)}
    >
      {children}
    </button>
  );
}

function CeoReportPanel({
  onOpenDrilldown,
  report,
}: {
  onOpenDrilldown: (filter: CeoReportDrilldownFilter) => void;
  report: CeoDashboardData["ceoReport"];
}) {
  const kpis = [
    {
      bucket: "진행중" as const,
      className: "bg-[#FFF1E7]",
      label: "진행 중",
      numberClassName: "text-[#D26A1E]",
      value: report.total.inProgressCount,
    },
    {
      bucket: "완료" as const,
      className: "bg-[#E9F2E2]",
      label: "완료",
      numberClassName: "text-[#2F6F2A]",
      value: report.total.completedCount,
    },
    {
      bucket: "지속" as const,
      className: "bg-[#ECE7F0]",
      label: "지속",
      numberClassName: "text-[#6A51AA]",
      value: report.total.continuingCount,
    },
  ];

  const openBucket = (bucket: CeoReportBucket, label: string) => {
    onOpenDrilldown({
      bucket,
      title: `${label} 지시사항`,
    });
  };

  const openDepartment = (
    departmentName: string,
    title: string,
    options?: { bucket?: CeoReportBucket; buckets?: CeoReportBucket[] },
  ) => {
    onOpenDrilldown({
      ...options,
      departmentName,
      title,
    });
  };

  const openSource = (
    sourceLabel: CeoReportSourceLabel,
    title: string,
    options?: { bucket?: CeoReportBucket; buckets?: CeoReportBucket[] },
  ) => {
    onOpenDrilldown({
      ...options,
      sourceLabel,
      title,
    });
  };

  return (
    <section
      aria-label="지시사항 이행 현황 보고"
      className="bg-white px-4 py-4 text-[#1F2F45] sm:px-6 sm:py-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-h-[4.4rem] w-full items-center rounded-[3px] bg-[#3F6090] px-5 py-3 text-white md:w-[72%] lg:min-h-[4rem] lg:px-7">
          <h2 className="text-2xl font-black leading-tight sm:text-3xl lg:text-[2rem]">지시사항 이행 현황 보고</h2>
        </div>
        <div className="flex flex-col justify-start text-left md:min-w-[14rem] md:pt-0.5 md:text-right">
          <p className="text-base font-black text-[#52657D] sm:text-lg">{report.meetingLabel}</p>
          <p className="mt-1 text-base font-black text-[#3F6090] sm:text-xl">{report.reportDateLabel}</p>
        </div>
      </div>

      <button
        type="button"
        aria-label={`전체 지시사항 ${report.total.totalCount}건 보기`}
        onClick={() => onOpenDrilldown({ title: "전체 지시사항" })}
        className={cn(
          reportMetricButtonClassName,
          "mt-7 block w-full bg-[#3F6090] px-4 py-3.5 text-center text-xl font-black text-white hover:bg-[#34527D] sm:text-2xl",
        )}
      >
        총 지시사항 {report.total.totalCount} 건
      </button>

      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            aria-label={`${kpi.label} 지시사항 ${kpi.value}건 보기`}
            onClick={() => openBucket(kpi.bucket, kpi.label)}
            className={cn(
              reportMetricButtonClassName,
              "min-h-[9.5rem] px-5 py-6 text-center lg:min-h-[10rem]",
              kpi.className,
            )}
          >
            <p className="text-lg font-black text-[#1F2F45] sm:text-xl">{kpi.label}</p>
            <p className={cn("mt-4 text-5xl font-black leading-none sm:text-6xl", kpi.numberClassName)}>
              {kpi.value}
              <span className="ml-2 text-3xl font-black">건</span>
            </p>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <div className="hidden overflow-hidden md:block">
          <table className="w-full table-fixed border-collapse text-left">
            <thead className="bg-[#E7EDF5] text-base font-black text-[#1F2F45]">
              <tr>
                <th className="w-[21%] px-4 py-3.5 text-center">담당 부서</th>
                <th className="w-[12%] px-3 py-3.5 text-center">총 건수</th>
                <th className="w-[10%] px-3 py-3.5 text-center text-[#D26A1E]">진행중</th>
                <th className="w-[10%] px-3 py-3.5 text-center text-[#2F6F2A]">완료</th>
                <th className="w-[10%] px-3 py-3.5 text-center text-[#6A51AA]">지속</th>
                <th className="w-[37%] px-4 py-3.5 text-center">이행률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5DEE8] text-lg font-black">
              {report.departmentSummary.map((department) => (
                <tr key={department.departmentName} className="bg-white">
                  <td className="px-4 py-3 text-center">
                    <ReportMetricButton
                      ariaLabel={`${department.departmentName} 지시사항 ${department.totalCount}건 보기`}
                      onClick={() =>
                        openDepartment(department.departmentName, `${department.departmentName} 지시사항`)
                      }
                      className="inline-flex min-h-8 items-center justify-center px-2 font-black"
                    >
                      {department.departmentName}
                    </ReportMetricButton>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ReportMetricButton
                      ariaLabel={`${department.departmentName} 전체 지시사항 ${department.totalCount}건 보기`}
                      onClick={() =>
                        openDepartment(department.departmentName, `${department.departmentName} 전체 지시사항`)
                      }
                      className="inline-flex min-h-8 items-center justify-center px-2 font-black"
                    >
                      {department.totalCount} 건
                    </ReportMetricButton>
                  </td>
                  <td className="px-3 py-3 text-center text-[#D26A1E]">
                    <ReportMetricButton
                      ariaLabel={`${department.departmentName} 진행중 지시사항 ${department.inProgressCount}건 보기`}
                      onClick={() =>
                        openDepartment(department.departmentName, `${department.departmentName} 진행중 지시사항`, {
                          bucket: "진행중",
                        })
                      }
                      className="inline-flex min-h-8 items-center justify-center px-2 font-black"
                    >
                      {department.inProgressCount} 건
                    </ReportMetricButton>
                  </td>
                  <td className="px-3 py-3 text-center text-[#2F6F2A]">
                    <ReportMetricButton
                      ariaLabel={`${department.departmentName} 완료 지시사항 ${department.completedCount}건 보기`}
                      onClick={() =>
                        openDepartment(department.departmentName, `${department.departmentName} 완료 지시사항`, {
                          bucket: "완료",
                        })
                      }
                      className="inline-flex min-h-8 items-center justify-center px-2 font-black"
                    >
                      {department.completedCount} 건
                    </ReportMetricButton>
                  </td>
                  <td className="px-3 py-3 text-center text-[#6A51AA]">
                    <ReportMetricButton
                      ariaLabel={`${department.departmentName} 지속 지시사항 ${department.continuingCount}건 보기`}
                      onClick={() =>
                        openDepartment(department.departmentName, `${department.departmentName} 지속 지시사항`, {
                          bucket: "지속",
                        })
                      }
                      className="inline-flex min-h-8 items-center justify-center px-2 font-black"
                    >
                      {department.continuingCount} 건
                    </ReportMetricButton>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      aria-label={`${department.departmentName} 이행 완료·지속 지시사항 ${
                        department.completedCount + department.continuingCount
                      }건 보기`}
                      onClick={() =>
                        openDepartment(department.departmentName, `${department.departmentName} 이행 지시사항`, {
                          buckets: ["완료", "지속"],
                        })
                      }
                      className={cn(
                        reportMetricButtonClassName,
                        "flex w-full items-center justify-between gap-6 px-2 py-1 font-black",
                      )}
                    >
                      <ReportRateBlocks rate={department.completionRate} />
                      <span className="w-14 shrink-0 text-right text-[#2F6F2A]">{department.completionRate}%</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:hidden">
          {report.departmentSummary.map((department) => (
            <div key={department.departmentName} className="border border-[#D5DEE8] bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  aria-label={`${department.departmentName} 지시사항 ${department.totalCount}건 보기`}
                  onClick={() => openDepartment(department.departmentName, `${department.departmentName} 지시사항`)}
                  className={cn(reportMetricButtonClassName, "text-left text-lg font-black")}
                >
                  {department.departmentName}
                </button>
                <span className="shrink-0 text-lg font-black text-[#2F6F2A]">{department.completionRate}%</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm font-black">
                <button
                  type="button"
                  aria-label={`${department.departmentName} 전체 지시사항 ${department.totalCount}건 보기`}
                  onClick={() => openDepartment(department.departmentName, `${department.departmentName} 전체 지시사항`)}
                  className={cn(reportMetricButtonClassName, "bg-[#E7EDF5] px-2 py-2 font-black")}
                >
                  총 {department.totalCount}건
                </button>
                <button
                  type="button"
                  aria-label={`${department.departmentName} 진행중 지시사항 ${department.inProgressCount}건 보기`}
                  onClick={() =>
                    openDepartment(department.departmentName, `${department.departmentName} 진행중 지시사항`, {
                      bucket: "진행중",
                    })
                  }
                  className={cn(reportMetricButtonClassName, "bg-[#FFF1E7] px-2 py-2 font-black text-[#D26A1E]")}
                >
                  진행 {department.inProgressCount}
                </button>
                <button
                  type="button"
                  aria-label={`${department.departmentName} 완료 지시사항 ${department.completedCount}건 보기`}
                  onClick={() =>
                    openDepartment(department.departmentName, `${department.departmentName} 완료 지시사항`, {
                      bucket: "완료",
                    })
                  }
                  className={cn(reportMetricButtonClassName, "bg-[#E9F2E2] px-2 py-2 font-black text-[#2F6F2A]")}
                >
                  완료 {department.completedCount}
                </button>
                <button
                  type="button"
                  aria-label={`${department.departmentName} 지속 지시사항 ${department.continuingCount}건 보기`}
                  onClick={() =>
                    openDepartment(department.departmentName, `${department.departmentName} 지속 지시사항`, {
                      bucket: "지속",
                    })
                  }
                  className={cn(reportMetricButtonClassName, "bg-[#ECE7F0] px-2 py-2 font-black text-[#6A51AA]")}
                >
                  지속 {department.continuingCount}
                </button>
              </div>
              <button
                type="button"
                aria-label={`${department.departmentName} 이행 완료·지속 지시사항 ${
                  department.completedCount + department.continuingCount
                }건 보기`}
                onClick={() =>
                  openDepartment(department.departmentName, `${department.departmentName} 이행 지시사항`, {
                    buckets: ["완료", "지속"],
                  })
                }
                className={cn(reportMetricButtonClassName, "mt-3 flex w-full items-center justify-between gap-3 py-1")}
              >
                <ReportRateBlocks rate={department.completionRate} />
                <span className="text-base font-black text-[#2F6F2A]">{department.completionRate}%</span>
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 divide-y divide-white text-base font-black sm:text-lg">
          {report.sourceSummary.map((source, index) => (
            <div
              key={source.sourceLabel}
              className={cn(
                "grid gap-3 px-4 py-2.5 md:grid-cols-[20rem_minmax(0,1fr)] md:items-center",
                index === 0 ? "bg-[#E7EDF5]" : "bg-[#F4EFE7]",
              )}
            >
              <div className="text-center md:text-left md:pl-20">
                <ReportMetricButton
                  ariaLabel={`${source.sourceLabel} 전체 지시사항 ${source.totalCount}건 보기`}
                  onClick={() => openSource(source.sourceLabel, `${source.sourceLabel} 지시사항`)}
                  className="inline-flex min-h-8 items-center justify-center px-2 font-black"
                >
                  {source.sourceLabel}
                </ReportMetricButton>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 md:justify-end">
                <ReportMetricButton
                  ariaLabel={`${source.sourceLabel} 전체 지시사항 ${source.totalCount}건 보기`}
                  onClick={() => openSource(source.sourceLabel, `${source.sourceLabel} 전체 지시사항`)}
                  className="inline-flex min-h-8 items-center justify-center px-1 font-black"
                >
                  총 {source.totalCount} 건
                </ReportMetricButton>
                <ReportMetricButton
                  ariaLabel={`${source.sourceLabel} 진행중 지시사항 ${source.inProgressCount}건 보기`}
                  onClick={() =>
                    openSource(source.sourceLabel, `${source.sourceLabel} 진행중 지시사항`, { bucket: "진행중" })
                  }
                  className="inline-flex min-h-8 items-center justify-center px-1 font-black text-[#D26A1E]"
                >
                  진행중 {source.inProgressCount}
                </ReportMetricButton>
                <ReportMetricButton
                  ariaLabel={`${source.sourceLabel} 완료 지시사항 ${source.completedCount}건 보기`}
                  onClick={() =>
                    openSource(source.sourceLabel, `${source.sourceLabel} 완료 지시사항`, { bucket: "완료" })
                  }
                  className="inline-flex min-h-8 items-center justify-center px-1 font-black text-[#2F6F2A]"
                >
                  완료 {source.completedCount}
                </ReportMetricButton>
                <ReportMetricButton
                  ariaLabel={`${source.sourceLabel} 지속 지시사항 ${source.continuingCount}건 보기`}
                  onClick={() =>
                    openSource(source.sourceLabel, `${source.sourceLabel} 지속 지시사항`, { bucket: "지속" })
                  }
                  className="inline-flex min-h-8 items-center justify-center px-1 font-black text-[#6A51AA]"
                >
                  지속 {source.continuingCount}
                </ReportMetricButton>
                <ReportMetricButton
                  ariaLabel={`${source.sourceLabel} 이행 완료·지속 지시사항 ${
                    source.completedCount + source.continuingCount
                  }건 보기`}
                  onClick={() =>
                    openSource(source.sourceLabel, `${source.sourceLabel} 이행 지시사항`, {
                      buckets: ["완료", "지속"],
                    })
                  }
                  className="inline-flex min-h-8 items-center justify-center px-1 font-black text-[#3F6090]"
                >
                  이행률 {source.completionRate}%
                </ReportMetricButton>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-1 text-right text-sm font-bold text-[#52657D]">
          ※ 이행률 = (완료 + 지속) / 총 건수 | 담당부서 복수 지정 건은 각 부서에 중복 반영
        </p>
      </div>
    </section>
  );
}

function formatReportDateLabel(dateString: string | null) {
  if (!dateString) {
    return null;
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("ko-KR", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function isReportItemDelayed(item: CeoReportDirectiveItem) {
  if (!item.dueDate || item.status === "COMPLETED") {
    return false;
  }

  const dueTime = new Date(item.dueDate).getTime();
  return Number.isFinite(dueTime) && dueTime < Date.now();
}

function CeoReportDirectiveDrilldown({
  filter,
  items,
  onClose,
}: {
  filter: CeoReportDrilldownFilter;
  items: CeoReportDirectiveItem[];
  onClose: () => void;
}) {
  const filteredItems = useMemo(() => filterCeoReportDirectiveItems(items, filter), [filter, items]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end overflow-hidden bg-ink-950/45 md:items-stretch md:p-5">
      <button
        type="button"
        aria-label="대표 보고 드릴다운 닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${filter.title} 지시사항 목록`}
        className="relative z-10 flex max-h-[88vh] w-full min-w-0 flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_24px_80px_rgba(6,18,38,0.28)] md:h-full md:max-h-none md:w-[min(36rem,calc(100vw-2rem))] md:rounded-[24px]"
      >
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-black text-brand-700">대표 보고 드릴다운</p>
              <h2 className="mt-1 break-words text-2xl font-black text-ink-950">
                {filter.title} · {filteredItems.length}건
              </h2>
            </div>
            <button
              type="button"
              aria-label="드릴다운 닫기"
              onClick={onClose}
              className="management-clickable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-2xl font-bold text-ink-700 shadow-sm transition hover:border-ink-400 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-300"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {filteredItems.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-ink-200 bg-ink-50 px-4 py-8 text-center text-base font-bold text-ink-600">
              해당 조건의 지시사항이 없습니다.
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredItems.map((item) => {
                const delayed = isReportItemDelayed(item);
                const dueDateLabel = formatReportDateLabel(item.dueDate);

                return (
                  <li key={item.id} className="rounded-[18px] border border-ink-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                          <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-700">{item.directiveNo}</span>
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">
                            {item.sourceLabel}
                          </span>
                          <span className="rounded-full bg-[#ECE7F0] px-2.5 py-1 text-[#6A51AA]">
                            {item.reportBucket}
                          </span>
                          <span className="rounded-full bg-ink-50 px-2.5 py-1 text-ink-700">
                            {item.statusLabel}
                          </span>
                          {delayed ? (
                            <span className="rounded-full bg-danger-50 px-2.5 py-1 text-danger-700">기한 경과</span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 break-words text-base font-black leading-snug text-ink-950">
                          {item.title}
                        </h3>
                        <dl className="mt-3 grid gap-2 text-sm font-semibold text-ink-700">
                          <div>
                            <dt className="sr-only">보고 담당부서</dt>
                            <dd>담당: {item.departmentNames.join(", ")}</dd>
                          </div>
                          {dueDateLabel ? (
                            <div>
                              <dt className="sr-only">기한</dt>
                              <dd>기한: {dueDateLabel}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                      <Link
                        href={item.href}
                        aria-label={`${item.directiveNo} ${item.title} 상세 보기`}
                        className="management-clickable inline-flex shrink-0 items-center justify-center rounded-[14px] border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-black text-brand-900 transition hover:border-brand-400 hover:bg-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-300"
                      >
                        상세 보기
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

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
      accentClassName: "bg-ink-700",
      ariaLabel: "전체 대기 지시사항 보기",
      label: "대기",
      shape: "ring",
      status: "NEW",
      urgent: false,
      value: `${summary.newCount}`,
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

function gradeClassName(grade: DepartmentAnalysisItem["executionGrade"]) {
  if (grade === "우수") {
    return "border-success-200 bg-success-50 text-success-700";
  }

  if (grade === "양호") {
    return "border-brand-200 bg-brand-50 text-brand-800";
  }

  if (grade === "주의") {
    return "border-warning-200 bg-warning-50 text-warning-700";
  }

  return "border-danger-200 bg-danger-50 text-danger-700";
}

function getBarWidth(value: number, maxValue: number) {
  if (maxValue <= 0) {
    return 0;
  }

  return Math.max(6, Math.round((value / maxValue) * 100));
}

function sortByExecutionScore(departments: DepartmentAnalysisItem[]) {
  return [...departments].sort((left, right) => {
    if (left.executionScore !== right.executionScore) {
      return right.executionScore - left.executionScore;
    }

    if (left.completionRate !== right.completionRate) {
      return right.completionRate - left.completionRate;
    }

    return right.totalCount - left.totalCount;
  });
}

function sortByRisk(departments: DepartmentAnalysisItem[]) {
  return [...departments].sort((left, right) => {
    const leftRisk = left.delayedCount * 3 + left.urgentCount * 4 + left.waitingApprovalCount * 2 + (100 - left.completionRate) / 20;
    const rightRisk = right.delayedCount * 3 + right.urgentCount * 4 + right.waitingApprovalCount * 2 + (100 - right.completionRate) / 20;

    return rightRisk - leftRisk;
  });
}

function getRiskLabel(department: DepartmentAnalysisItem) {
  if (department.delayedCount > 0 || department.urgentCount > 0 || department.executionGrade === "위험") {
    return "위험";
  }

  if (department.waitingApprovalCount > 0 || department.completionRate < 60 || department.executionGrade === "주의") {
    return "주의";
  }

  return "정상";
}

function getRiskMessage(department: DepartmentAnalysisItem) {
  if (department.delayedCount > 0) {
    return `지연 ${department.delayedCount}건`;
  }

  if (department.urgentCount > 0) {
    return `긴급 ${department.urgentCount}건`;
  }

  if (department.waitingApprovalCount > 0) {
    return `승인 대기 ${department.waitingApprovalCount}건`;
  }

  return `완료율 ${department.completionRate}%`;
}

function AnalysisDetailButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="management-clickable mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[16px] border border-ink-200 bg-white px-4 py-2 text-base font-bold text-ink-950 shadow-[0_10px_24px_rgba(6,18,38,0.08)] transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-300 active:translate-y-[1px] sm:w-auto"
    >
      {children} →
    </button>
  );
}

function DepartmentCompletionChart({
  departments,
  onOpenDetail,
}: {
  departments: DepartmentAnalysisItem[];
  onOpenDetail: () => void;
}) {
  const visibleDepartments = sortByExecutionScore(departments).slice(0, 5);

  return (
    <section className={analysisCardClassName}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-ink-950">부서별 완료율</h3>
          <p className="mt-1 line-clamp-2 text-base font-semibold text-ink-700">완료 비율이 높은 부서부터 요약합니다.</p>
        </div>
        <span className="shrink-0 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-bold text-brand-800">
          완료
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {visibleDepartments.map((department) => (
          <div key={department.departmentId}>
            <div className="flex items-center justify-between gap-3 text-base font-bold text-ink-950">
              <span className="truncate">{department.departmentName}</span>
              <span>{department.completionRate}%</span>
            </div>
            <div className="mt-2 h-4 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-700),var(--color-success-600))]"
                style={{ width: `${Math.max(4, department.completionRate)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <AnalysisDetailButton onClick={onOpenDetail}>자세히 보기</AnalysisDetailButton>
    </section>
  );
}

function DepartmentDelayChart({ departments }: { departments: DepartmentAnalysisItem[] }) {
  const visibleDepartments = [...departments].sort((left, right) => right.delayedCount - left.delayedCount).slice(0, 6);
  const maxDelayed = Math.max(1, ...visibleDepartments.map((department) => department.delayedCount));

  return (
    <section className={analysisCardClassName}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-ink-950">부서별 지연 현황</h3>
          <p className="mt-1 line-clamp-2 text-base font-semibold text-ink-700">지연 건수는 색과 숫자로 함께 표시합니다.</p>
        </div>
        <span className="shrink-0 rounded-full border border-danger-200 bg-danger-50 px-3 py-1 text-sm font-bold text-danger-700">
          지연
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {visibleDepartments.map((department) => (
          <div key={department.departmentId}>
            <div className="flex items-center justify-between gap-3 text-base font-bold text-ink-950">
              <span className="truncate">{department.departmentName}</span>
              <span>{department.delayedCount}건</span>
            </div>
            <div className="mt-2 h-4 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
              <div
                className={cn(
                  "h-full rounded-full",
                  department.delayedCount > 0 ? "bg-danger-600" : "bg-success-500",
                )}
                style={{ width: `${getBarWidth(department.delayedCount, maxDelayed)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UrgentSummaryPanel({
  departments,
  onOpenDetail,
}: {
  departments: DepartmentAnalysisItem[];
  onOpenDetail: () => void;
}) {
  const urgentTotal = departments.reduce((sum, department) => sum + department.urgentCount, 0);
  const urgentDepartments = departments.filter((department) => department.urgentCount > 0).length;
  const delayedTotal = departments.reduce((sum, department) => sum + department.delayedCount, 0);

  return (
    <section className={analysisCardClassName}>
      <h3 className="text-xl font-bold text-ink-950">긴급 처리 현황</h3>
      <p className="mt-1 line-clamp-2 text-base font-semibold text-ink-700">긴급과 지연을 같은 화면에서 확인합니다.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["긴급 지시", `${urgentTotal}건`, "즉시 확인"],
          ["긴급 부서", `${urgentDepartments}곳`, "부서별 점검"],
          ["지연 지시", `${delayedTotal}건`, "기한 관리"],
        ].map(([label, value, helper]) => (
          <div key={label} className="min-w-0 overflow-hidden break-words whitespace-normal rounded-[22px] border border-ink-100 bg-ink-50 px-4 py-4">
            <p className="text-base font-bold text-ink-800">{label}</p>
            <p className="mt-2 text-3xl font-bold text-ink-950">{value}</p>
            <p className="mt-1 text-sm font-semibold text-ink-700">{helper}</p>
          </div>
        ))}
      </div>

      <AnalysisDetailButton onClick={onOpenDetail}>자세히 보기</AnalysisDetailButton>
    </section>
  );
}

function DepartmentExecutionRanking({
  departments,
  onOpenDetail,
}: {
  departments: DepartmentAnalysisItem[];
  onOpenDetail: () => void;
}) {
  const rankedDepartments = sortByExecutionScore(departments).slice(0, 5);

  return (
    <section className={analysisCardClassName}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-ink-950">부서 이행 순위</h2>
          <p className="mt-1 line-clamp-2 text-base font-semibold text-ink-700">이행 점수는 지연, 긴급, 승인 대기 적체를 함께 반영합니다.</p>
        </div>
        <p className="shrink-0 rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-sm font-bold text-ink-700">100점 기준</p>
      </div>

      <div className="mt-5 space-y-3">
        {rankedDepartments.map((department) => (
          <div
            key={department.departmentId}
            className="min-w-0 rounded-[20px] border border-ink-100 bg-ink-50 px-4 py-3"
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-ink-950">{department.departmentName}</p>
                <p className="mt-1 truncate text-base font-semibold text-ink-700">
                  완료율 {department.completionRate}% · 지연 {department.delayedCount}건
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-3xl font-bold text-ink-950">{department.executionScore}</p>
                <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-sm font-bold", gradeClassName(department.executionGrade))}>
                  {department.executionGrade}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnalysisDetailButton onClick={onOpenDetail}>자세히 보기</AnalysisDetailButton>
    </section>
  );
}

function RiskSignalPanel({
  departments,
  onOpenDetail,
}: {
  departments: DepartmentAnalysisItem[];
  onOpenDetail: () => void;
}) {
  const riskDepartments = sortByRisk(departments)
    .filter(
      (department) =>
        department.delayedCount > 0 ||
        department.urgentCount > 0 ||
        department.waitingApprovalCount > 0 ||
        department.completionRate < 60,
    )
    .slice(0, 3);

  return (
    <section className={cn(analysisCardClassName, "border-danger-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,247,0.86))]")}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-ink-950">오늘 확인할 실행 리스크</h2>
          <p className="mt-1 line-clamp-2 text-base font-semibold text-ink-700">지연, 긴급, 승인 대기 적체를 먼저 보여줍니다.</p>
        </div>
        <span className="shrink-0 rounded-full border border-danger-200 bg-danger-50 px-3 py-1 text-sm font-bold text-danger-700">
          확인 필요
        </span>
      </div>

      {riskDepartments.length === 0 ? (
        <div className="mt-5 rounded-[22px] border border-success-200 bg-success-50 px-5 py-5 text-base font-bold text-success-700">
          오늘 즉시 확인할 위험 신호가 없습니다.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {riskDepartments.map((department) => {
            const riskLabel = getRiskLabel(department);
            const message = getRiskMessage(department);

            return (
              <div key={department.departmentId} className="min-w-0 overflow-hidden rounded-[20px] border border-danger-100 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-sm font-bold", riskLabel === "위험" ? "border-danger-200 bg-danger-50 text-danger-700" : "border-warning-200 bg-warning-50 text-warning-700")}>
                    {riskLabel}
                  </span>
                  <p className="min-w-0 truncate text-lg font-bold text-ink-950">
                    {department.departmentName} · {message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnalysisDetailButton onClick={onOpenDetail}>위험 상세 보기</AnalysisDetailButton>
    </section>
  );
}

function DepartmentActionButtons({
  department,
  onDepartmentSelect,
  onStatusSelect,
}: {
  department: DepartmentAnalysisItem;
  onDepartmentSelect: (departmentId: string) => void;
  onStatusSelect: (departmentId: string, status: DirectiveStatusValue | null, urgent?: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => onDepartmentSelect(department.departmentId)}
        className={analysisActionClassName}
      >
        부서 보기
      </button>
      <button
        type="button"
        onClick={() => onStatusSelect(department.departmentId, "DELAYED", false)}
        className={dangerActionClassName}
      >
        지연 보기
      </button>
      <button
        type="button"
        onClick={() => onStatusSelect(department.departmentId, null, true)}
        className={dangerActionClassName}
      >
        긴급 보기
      </button>
    </div>
  );
}

function ExecutiveAnalysisModal({
  departments,
  kind,
  onClose,
  onDepartmentSelect,
  onStatusSelect,
}: {
  departments: DepartmentAnalysisItem[];
  kind: AnalysisModalType;
  onClose: () => void;
  onDepartmentSelect: (departmentId: string) => void;
  onStatusSelect: (departmentId: string, status: DirectiveStatusValue | null, urgent?: boolean) => void;
}) {
  const titleMap: Record<AnalysisModalType, string> = {
    completion: "부서별 완료율 상세",
    ranking: "부서 이행 순위 상세",
    risk: "오늘 확인할 실행 리스크 상세",
    urgent: "긴급 처리 현황 상세",
  };
  const sortedDepartments = kind === "completion"
    ? sortByExecutionScore(departments)
    : kind === "risk"
      ? sortByRisk(departments)
      : kind === "urgent"
        ? [...departments].sort((left, right) => right.urgentCount + right.delayedCount - (left.urgentCount + left.delayedCount))
        : sortByExecutionScore(departments);

  const handleDepartmentSelect = (departmentId: string) => {
    onClose();
    onDepartmentSelect(departmentId);
  };

  const handleStatusSelect = (
    departmentId: string,
    status: DirectiveStatusValue | null,
    urgent = false,
  ) => {
    onClose();
    onStatusSelect(departmentId, status, urgent);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 px-3 py-5 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={titleMap[kind]}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_32px_90px_rgba(6,18,38,0.28)]"
      >
        <div className="flex min-w-0 items-start justify-between gap-4 border-b border-ink-100 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="text-base font-bold text-brand-700">상세 분석</p>
            <h2 className="mt-1 text-2xl font-bold text-ink-950 sm:text-3xl">{titleMap[kind]}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="management-clickable min-h-11 shrink-0 rounded-[16px] border border-ink-200 bg-white px-4 py-2 text-base font-bold text-ink-900 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-300"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7">
          <div className="overflow-x-auto rounded-[22px] border border-ink-100">
            <table className="min-w-[58rem] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-base font-bold text-ink-800">
                  <th className="px-4 py-3">부서명</th>
                  <th className="px-4 py-3">완료율</th>
                  <th className="px-4 py-3">지연</th>
                  <th className="px-4 py-3">긴급</th>
                  <th className="px-4 py-3">승인 대기</th>
                  <th className="px-4 py-3">이행 점수</th>
                  <th className="px-4 py-3 text-right">보기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sortedDepartments.map((department) => (
                  <tr key={department.departmentId} className="transition hover:bg-brand-50/55">
                    <td className="px-4 py-4 text-lg font-bold text-ink-950">{department.departmentName}</td>
                    <td className="px-4 py-4 text-base font-bold text-ink-900">{department.completionRate}%</td>
                    <td className="px-4 py-4 text-base font-bold text-danger-700">{department.delayedCount}건</td>
                    <td className="px-4 py-4 text-base font-bold text-danger-700">{department.urgentCount}건</td>
                    <td className="px-4 py-4 text-base font-bold text-warning-700">{department.waitingApprovalCount}건</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-ink-950">{department.executionScore}</span>
                        <span className={cn("rounded-full border px-3 py-1 text-sm font-bold", gradeClassName(department.executionGrade))}>
                          {department.executionGrade}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <DepartmentActionButtons
                        department={department}
                        onDepartmentSelect={handleDepartmentSelect}
                        onStatusSelect={handleStatusSelect}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
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
  const impersonation = useStoredImpersonationState();
  const [selectedScope, setSelectedScope] = useState<SelectedScope>("none");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DirectiveStatusValue | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [openAnalysisModal, setOpenAnalysisModal] = useState<AnalysisModalType | null>(null);
  const [reportDrilldownFilter, setReportDrilldownFilter] = useState<CeoReportDrilldownFilter | null>(null);
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

  const selectDepartment = useCallback((departmentId: string) => {
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
  }, []);

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

  const closeReportDrilldown = useCallback(() => {
    setReportDrilldownFilter(null);
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

  const selectSummaryCard = useCallback(
    (card: SummaryCard) => {
      if (card.status === "NEW") {
        selectGlobalStatus("NEW", false);
        return;
      }

      if (card.status === "COMPLETION_REQUESTED") {
        selectGlobalStatus("COMPLETION_REQUESTED", false);
        return;
      }

      if (card.urgent) {
        selectGlobalStatus(null, true);
        return;
      }

      selectGlobalStatus(card.status, card.urgent);
    },
    [selectGlobalStatus],
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
      if (window.matchMedia("(max-width: 1279px)").matches) {
        detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [shouldShowPanel, selectedDepartmentId, selectedStatus, urgentOnly]);

  return (
    <div className="space-y-7">
      {impersonation.active && impersonation.userName ? (
        <div className="rounded-[24px] border border-warning-200 bg-warning-50 px-5 py-4 text-base font-bold text-ink-950 shadow-[0_18px_42px_rgba(245,158,11,0.12)]">
          대리 확인 중: {impersonation.userName}
        </div>
      ) : null}

      <div className={cn(shouldShowPanel && "xl:pr-[640px] 2xl:pr-[680px]")}>
        <CeoReportPanel report={data.ceoReport} onOpenDrilldown={setReportDrilldownFilter} />
      </div>

      <section aria-label="경영 요약" className={cn("space-y-4", shouldShowPanel && "xl:pr-[640px] 2xl:pr-[680px]")}>
        <div>
          <p className="text-base font-bold text-brand-700">경영 요약</p>
          <h1 className="mt-1 text-3xl font-bold text-ink-950">대표 대시보드</h1>
          <p className="mt-2 text-base font-semibold text-ink-700">
            요약, 부서 성과, 위험 신호, 지시 리스트 순서로 확인합니다.
          </p>
        </div>

        <div aria-label="상단 요약 영역" className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {summaryCards.map((card) => {
            const isActive = selectedScope === "global" && selectedStatus === card.status && urgentOnly === card.urgent;

            return (
              <button
                key={card.label}
                type="button"
                aria-label={card.ariaLabel}
                aria-pressed={isActive}
                onClick={() => selectSummaryCard(card)}
                onPointerEnter={() => prefetchGlobalStatus(card.status, card.urgent)}
                className={cn(
                  "executive-click-target min-h-[9rem] rounded-[24px] border border-white/80 bg-white px-5 py-5 text-left shadow-[0_18px_42px_rgba(6,18,38,0.08)]",
                  isActive && "border-brand-900 bg-brand-50 ring-4 ring-brand-100",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-ink-800">{card.label}</p>
                    {isActive ? (
                      <span className="mt-2 inline-flex rounded-full bg-brand-900 px-3 py-1 text-sm font-bold text-white">
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
        </div>
      </section>

      <section aria-label="부서 성과와 위험 신호" className={cn("space-y-5", shouldShowPanel && "xl:pr-[640px] 2xl:pr-[680px]")}>
        <DepartmentExecutionRanking
          departments={data.departments}
          onOpenDetail={() => setOpenAnalysisModal("ranking")}
        />

        <div className="grid gap-5 2xl:grid-cols-[1fr_1fr]">
          <div className="grid gap-5">
            <DepartmentCompletionChart
              departments={data.departments}
              onOpenDetail={() => setOpenAnalysisModal("completion")}
            />
            <DepartmentDelayChart departments={data.departments} />
          </div>
          <div className="grid gap-5">
            <UrgentSummaryPanel
              departments={data.departments}
              onOpenDetail={() => setOpenAnalysisModal("urgent")}
            />
            <RiskSignalPanel
              departments={data.departments}
              onOpenDetail={() => setOpenAnalysisModal("risk")}
            />
          </div>
        </div>
      </section>

      <section
        aria-label="부서 현황"
        className={cn("space-y-4", shouldShowPanel && "xl:pr-[640px] 2xl:pr-[680px]")}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-ink-950">부서 현황</h2>
            <p className="mt-1 text-base font-semibold text-ink-700">
              부서를 누르면 오른쪽 확인창에서 지시사항을 바로 확인합니다.
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
                className="z-40 min-w-0 xl:fixed xl:right-6 xl:top-6 xl:bottom-6 xl:w-[600px] 2xl:w-[640px]"
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

      {openAnalysisModal ? (
        <ExecutiveAnalysisModal
          departments={data.departments}
          kind={openAnalysisModal}
          onClose={() => setOpenAnalysisModal(null)}
          onDepartmentSelect={selectDepartment}
          onStatusSelect={selectDepartmentStatus}
        />
      ) : null}

      {reportDrilldownFilter ? (
        <CeoReportDirectiveDrilldown
          filter={reportDrilldownFilter}
          items={data.ceoReport.items}
          onClose={closeReportDrilldown}
        />
      ) : null}
    </div>
  );
}
