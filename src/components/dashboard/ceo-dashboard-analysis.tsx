"use client";

import { useState } from "react";

import type { CeoDashboardData } from "@/features/dashboard";
import { formatDateTimeLabel, formatPercentLabel, formatRelativeUpdate } from "@/lib";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type CeoDashboardAnalysisProps = Pick<
  CeoDashboardData,
  "departments" | "latestReport" | "recentActivity" | "reportSummaryCards" | "weeklyTrend"
>;

type AnalysisTab = "activity" | "departments" | "trend";

export function CeoDashboardAnalysis({
  departments,
  latestReport,
  recentActivity,
  reportSummaryCards,
  weeklyTrend,
}: CeoDashboardAnalysisProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("departments");

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">분석 영역</h2>
          <p className="mt-1 text-sm text-ink-700">요약 다음 단계의 분석은 탭으로 정리해 첫 화면 집중도를 낮췄습니다.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["departments", "부서 현황"],
            ["activity", "최근 활동"],
            ["trend", "주간 추이"],
          ].map(([value, label]) => {
            const isActive = activeTab === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value as AnalysisTab)}
                className={
                  isActive
                    ? "rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "departments" ? (
        departments.length === 0 ? (
          <EmptyState title="부서 현황이 없습니다." description="지시가 생성되면 부서별 실행 현황이 여기에 정리됩니다." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {departments.map((department) => (
              <div key={department.departmentName} className="rounded-[26px] border border-brand-100/80 bg-white px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-ink-950">{department.departmentName}</p>
                    <p className="mt-2 text-sm text-ink-700">{`총 ${department.totalCount}건 · 완료 ${department.completedCount}건`}</p>
                  </div>
                  <Badge tone={department.delayedCount > 0 ? "warning" : "success"}>
                    완료율 {department.completionRate}%
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="warning">{`승인 대기 ${department.waitingApprovalCount}`}</Badge>
                  <Badge tone="danger">{`지연 ${department.delayedCount}`}</Badge>
                  <Badge tone="default">{`긴급 ${department.urgentCount}`}</Badge>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === "activity" ? (
        recentActivity.length === 0 ? (
          <EmptyState title="최근 활동이 없습니다." description="현장 로그가 쌓이면 최근 활동 요약이 여기에 표시됩니다." />
        ) : (
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={`${activity.directiveId}-${activity.logId}`} className="rounded-[24px] border border-ink-200/90 bg-white px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="default">{activity.logType}</Badge>
                  <span className="text-xs text-ink-500">{formatDateTimeLabel(activity.happenedAt)}</span>
                  <span className="text-xs text-ink-500">{formatRelativeUpdate(activity.happenedAt)}</span>
                </div>
                <p className="mt-3 text-base font-semibold text-ink-950">{activity.actionSummary}</p>
                <p className="mt-1 text-sm text-ink-700">
                  {activity.directiveNo} · {activity.directiveTitle}
                  {activity.userName ? ` · ${activity.userName}` : ""}
                </p>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === "trend" ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            {reportSummaryCards.map((card) => (
              <div key={card.label} className="rounded-[24px] border border-ink-200/90 bg-white px-4 py-4">
                <p className="text-xs font-semibold tracking-[0.18em] text-ink-500 uppercase">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-ink-950">{card.value}</p>
                {card.description ? <p className="mt-1 text-sm text-ink-600">{card.description}</p> : null}
              </div>
            ))}
          </div>

          {latestReport ? (
            <div className="rounded-[26px] border border-brand-100/80 bg-brand-50/60 px-5 py-5">
              <p className="text-sm font-semibold text-ink-950">최신 주간 보고</p>
              <p className="mt-2 text-sm text-ink-700">
                완료율 {formatPercentLabel(latestReport.completionRate)} · 기한 준수율 {formatPercentLabel(latestReport.onTimeCompletionRate)}
              </p>
            </div>
          ) : null}

          {weeklyTrend.length === 0 ? (
            <EmptyState title="주간 추이가 없습니다." description="주간 보고가 생성되면 추이 분석이 여기에 표시됩니다." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {weeklyTrend.map((point) => (
                <div key={point.label} className="rounded-[24px] border border-ink-200/90 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-ink-950">{point.label}</p>
                  <div className="mt-3 space-y-2 text-sm text-ink-700">
                    <p>{`총 ${point.totalCount}건 · 완료 ${point.completedCount}건`}</p>
                    <p>{`지연 ${point.delayedCount}건 · 완료율 ${formatPercentLabel(point.completionRate)}`}</p>
                    <p>{`기한 준수율 ${formatPercentLabel(point.onTimeCompletionRate)}`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}
