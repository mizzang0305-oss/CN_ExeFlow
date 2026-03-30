import Link from "next/link";

import { AppFrame, Badge, EmptyState, ErrorState, KpiCard, SectionCard, StatusPill } from "@/components";
import { NotificationPermissionBanner } from "@/components/dashboard/notification-permission-banner";
import { requireDashboardSession } from "@/features/auth";
import {
  directiveLogTypeLabels,
  directiveUrgentLevelLabels,
  getDashboardData,
  type DirectiveListItem,
} from "@/features/directives";
import { formatDateLabel, formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

type DepartmentExecutionSummary = {
  completedCount: number;
  delayedCount: number;
  departmentName: string;
  inProgressCount: number;
  totalCount: number;
  urgentCount: number;
  waitingApprovalCount: number;
};

function summarizeDepartments(items: DirectiveListItem[]): DepartmentExecutionSummary[] {
  const summaryMap = new Map<string, DepartmentExecutionSummary>();

  for (const item of items) {
    const key = item.ownerDepartmentName ?? "주관 부서 미지정";
    const current = summaryMap.get(key) ?? {
      completedCount: 0,
      delayedCount: 0,
      departmentName: key,
      inProgressCount: 0,
      totalCount: 0,
      urgentCount: 0,
      waitingApprovalCount: 0,
    };

    current.totalCount += 1;
    current.completedCount += item.status === "COMPLETED" ? 1 : 0;
    current.delayedCount += item.isDelayed ? 1 : 0;
    current.inProgressCount += item.status === "IN_PROGRESS" ? 1 : 0;
    current.urgentCount += item.isUrgent ? 1 : 0;
    current.waitingApprovalCount += item.status === "COMPLETION_REQUESTED" ? 1 : 0;

    summaryMap.set(key, current);
  }

  return Array.from(summaryMap.values())
    .sort((left, right) => {
      const leftRisk = left.urgentCount + left.delayedCount + left.waitingApprovalCount;
      const rightRisk = right.urgentCount + right.delayedCount + right.waitingApprovalCount;

      if (leftRisk !== rightRisk) {
        return rightRisk - leftRisk;
      }

      return right.totalCount - left.totalCount;
    })
    .slice(0, 6);
}

function describeTarget(item: DirectiveListItem) {
  if (item.targetScope === "ALL") {
    return `전사 대상 · 주관 ${item.ownerDepartmentName ?? "미지정"}`;
  }

  return `대상 ${item.targetDepartmentCount}개 부서 · 주관 ${item.ownerDepartmentName ?? "미지정"}`;
}

function formatUrgentLevel(urgentLevel: DirectiveListItem["urgentLevel"]) {
  return urgentLevel ? directiveUrgentLevelLabels[urgentLevel] : "긴급";
}

const kpiHrefMap: Record<string, string> = {
  "긴급": "/directives?urgent=true",
  "승인 대기": "/directives?status=COMPLETION_REQUESTED",
  "완료": "/directives?status=COMPLETED",
  "전체 건수": "/directives",
  "지연": "/directives?status=DELAYED",
  "진행 중": "/directives?status=IN_PROGRESS",
};

export default async function DashboardPage() {
  const session = await requireDashboardSession();

  let dashboard: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let errorMessage: string | null = null;

  try {
    dashboard = await getDashboardData(session);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "대표 대시보드를 불러오지 못했습니다.";
  }

  if (errorMessage || !dashboard) {
    return (
      <AppFrame
        currentPath="/dashboard"
        session={session}
        title="대표 대시보드"
        description="대표가 전체 실행 흐름과 승인 대기, 지연 신호를 한 화면에서 통제하는 공간입니다."
      >
        <ErrorState
          title="대표 대시보드를 불러오지 못했습니다"
          description={errorMessage ?? "잠시 후 다시 시도해주세요."}
        />
      </AppFrame>
    );
  }

  const departmentSummaries = summarizeDepartments(dashboard.items);
  const priorityCount = dashboard.urgentItems.length + dashboard.waitingApprovalItems.length;
  const summaryLinks = [
    {
      description: "즉시 판단 필요 건",
      href: "/directives?urgent=true",
      label: "즉시 판단",
      value: priorityCount,
    },
    {
      description: "승인 대기 큐 바로가기",
      href: "/directives/approval-queue",
      label: "승인 대기",
      value: dashboard.waitingApprovalItems.length,
    },
    {
      description: "지연 관리 목록 이동",
      href: "/directives?status=DELAYED",
      label: "지연",
      value: dashboard.delayedItems.length,
    },
    {
      description: "지시 목록 전체 보기",
      href: "/directives",
      label: "최근 업데이트",
      value: dashboard.recentUpdates.length,
    },
  ];

  return (
    <AppFrame
      currentPath="/dashboard"
      session={session}
      title="대표 대시보드"
      description="숫자, 승인 대기, 지연 리스크, 최근 실행 이력을 한 흐름으로 연결해 즉시 판단할 수 있도록 정리했습니다."
    >
      <div className="space-y-6">
        <NotificationPermissionBanner />

        <section className="panel-strong relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,130,237,0.14),transparent_30%)]" />
          <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="default">대표 실행 통제</StatusPill>
                <StatusPill tone="danger">{`긴급 ${dashboard.urgentItems.length}건`}</StatusPill>
                <StatusPill tone="warning">{`지연 ${dashboard.delayedItems.length}건`}</StatusPill>
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-ink-950 sm:text-[2.2rem]">
                  실행 흐름과 승인 병목을 한 화면에서 바로 보는 대표 통제 뷰
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-700">
                  숫자를 먼저 보고, 그다음 긴급 건과 승인 대기, 지연 신호, 최근 업데이트까지 바로 이어서 살필 수 있도록
                  배치했습니다.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {summaryLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-[26px] border border-ink-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)] transition hover:border-brand-300 hover:bg-brand-50/70"
                  >
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-600 uppercase">{item.label}</p>
                    <p className="mt-2 text-3xl font-semibold text-ink-950">{item.value}</p>
                    <p className="mt-1 text-sm text-ink-700">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-brand-100/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(238,244,255,0.84))] p-5 shadow-[0_26px_56px_rgba(3,19,38,0.09)]">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-700 uppercase">대표 판단 순서</p>
              <div className="mt-4 space-y-3">
                {[
                  ["숫자 확인", "전체, 진행 중, 지연, 완료, 긴급, 승인 대기 KPI로 전체 흐름을 먼저 파악합니다."],
                  ["긴급 조치", "대표 판단이 바로 필요한 긴급 항목을 상단에서 우선 확인합니다."],
                  ["승인 처리", "부서별 완료 요청은 승인 대기 큐와 상세 화면에서 바로 승인하거나 반려합니다."],
                  ["최근 로그 확인", "최신 업데이트는 로그 위치까지 바로 이동해 맥락을 끊지 않게 했습니다."],
                ].map(([title, description], index) => (
                  <div key={title} className="flex gap-3 rounded-[24px] border border-white/70 bg-white/86 px-4 py-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-950">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-ink-700">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {dashboard.kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} href={kpiHrefMap[kpi.label]} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.16fr_0.84fr]">
          <SectionCard
            accent="danger"
            title="대표 우선 확인"
            description="긴급하거나 마감 압박이 큰 지시를 먼저 확인해 바로 판단할 수 있도록 정리했습니다."
            action={
              <Link href="/directives?urgent=true">
                <Badge tone="danger">{`${dashboard.urgentItems.length}건`}</Badge>
              </Link>
            }
          >
            {dashboard.urgentItems.length === 0 ? (
              <EmptyState
                title="긴급 집행 건이 없습니다"
                description="즉시 판단이 필요한 긴급 지시는 현재 없습니다."
              />
            ) : (
              <div className="grid gap-3">
                {dashboard.urgentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="group rounded-[28px] border border-danger-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,241,0.9))] px-5 py-5 shadow-[0_18px_42px_rgba(220,38,38,0.08)] transition hover:border-danger-300 hover:bg-danger-50"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="danger">{formatUrgentLevel(item.urgentLevel)}</Badge>
                          <Badge tone="muted">{item.directiveNo}</Badge>
                          <Badge tone="warning">{`마감 ${formatDateLabel(item.dueDate)}`}</Badge>
                        </div>
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-ink-950">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-ink-700">
                            {describeTarget(item)}
                            {item.ownerUserName ? ` · 담당 ${item.ownerUserName}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-danger-200/70 bg-white/82 px-4 py-3 text-sm text-ink-700">
                        <p className="font-semibold text-danger-700">{`지연 부서 ${item.departmentProgress.DELAYED}개`}</p>
                        <p className="mt-1">{`승인 대기 ${item.departmentProgress.COMPLETION_REQUESTED}개`}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            accent="warning"
            title="승인 대기"
            description="부서별 완료 요청을 큐와 상세 화면으로 바로 연결해 승인 병목을 줄였습니다."
            action={
              <Link href="/directives/approval-queue">
                <Badge tone="warning">{`${dashboard.waitingApprovalItems.length}건`}</Badge>
              </Link>
            }
          >
            {dashboard.waitingApprovalItems.length === 0 ? (
              <EmptyState
                title="승인 대기 항목이 없습니다"
                description="대표 승인 또는 최종 확인이 필요한 완료 요청이 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.waitingApprovalItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="rounded-[26px] border border-warning-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,236,0.92))] px-5 py-5 shadow-[0_18px_38px_rgba(217,119,6,0.08)] transition hover:border-warning-300 hover:bg-warning-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">승인 대기</Badge>
                      <Badge tone="muted">{item.directiveNo}</Badge>
                    </div>
                    <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      {`대상 ${item.targetDepartmentCount}개 부서 · 완료 요청 ${item.departmentProgress.COMPLETION_REQUESTED}개`}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <SectionCard
            accent="warning"
            title="운영 리스크"
            description="지연 신호가 큰 지시를 따로 모아 우선순위 높은 리스크 목록으로 구성했습니다."
            action={
              <Link href="/directives?status=DELAYED">
                <Badge tone="warning">{`${dashboard.delayedItems.length}건`}</Badge>
              </Link>
            }
          >
            {dashboard.delayedItems.length === 0 ? (
              <EmptyState
                title="지연 리스크가 없습니다"
                description="현재 마감이 지난 미완료 지시는 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.delayedItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="rounded-[26px] border border-warning-200/80 bg-white px-5 py-5 transition hover:border-warning-300 hover:bg-warning-50/40"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warning">지연</Badge>
                          <Badge tone="muted">{item.directiveNo}</Badge>
                        </div>
                        <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-700">
                          {`주관 ${item.ownerDepartmentName ?? "미지정"} · 지연 부서 ${item.departmentProgress.DELAYED}개`}
                        </p>
                      </div>
                      <div className="rounded-[20px] bg-warning-50 px-4 py-3 text-right">
                        <p className="text-xs font-semibold tracking-[0.18em] text-warning-700 uppercase">마감일</p>
                        <p className="mt-1 text-sm font-semibold text-ink-950">{formatDateLabel(item.dueDate)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            accent="brand"
            title="최근 업데이트"
            description="최근 실행 로그는 텍스트가 흔들리지 않도록 장식 효과를 제외하고, 클릭 시 해당 로그 위치로 바로 이동합니다."
            action={
              <Link href="/directives">
                <Badge tone="default">{`${dashboard.recentUpdates.length}건`}</Badge>
              </Link>
            }
          >
            {dashboard.recentUpdates.length === 0 ? (
              <EmptyState
                title="최근 업데이트가 없습니다"
                description="실행 로그가 등록되면 여기에서 최신 흐름을 바로 확인할 수 있습니다."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.recentUpdates.map((update) => (
                  <Link
                    key={`${update.directiveId}-${update.logId}`}
                    href={`/directives/${update.directiveId}#log-${update.logId}`}
                    className="group relative rounded-[26px] border border-brand-100/80 bg-white px-5 py-5 transition hover:border-brand-300 hover:bg-brand-50/35"
                  >
                    <div className="pointer-events-none absolute inset-y-5 left-5 w-px bg-brand-100" />
                    <div className="relative space-y-3 opacity-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="default">{directiveLogTypeLabels[update.logType]}</Badge>
                        <span className="text-xs font-medium text-ink-500 opacity-100">
                          {formatDateTimeLabel(update.happenedAt)} · {formatRelativeUpdate(update.happenedAt)}
                        </span>
                      </div>
                      <p className="pl-4 text-base font-semibold text-ink-950 opacity-100">{update.actionSummary}</p>
                      <p className="pl-4 text-sm leading-6 text-ink-700 opacity-100">
                        {update.directiveNo} · {update.directiveTitle}
                        {update.userName ? ` · ${update.userName}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <SectionCard
          accent="brand"
          title="부서별 실행 현황"
          description="주관 부서 기준으로 어떤 조직에서 긴급, 승인 대기, 지연 신호가 쌓이는지 한 번에 볼 수 있게 요약했습니다."
        >
          {departmentSummaries.length === 0 ? (
            <EmptyState
              title="집계할 부서 현황이 없습니다"
              description="주관 부서가 연결된 지시가 생기면 부서별 요약이 표시됩니다."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {departmentSummaries.map((department) => {
                const completionRate = department.totalCount
                  ? Math.round((department.completedCount / department.totalCount) * 100)
                  : 0;

                return (
                  <div
                    key={department.departmentName}
                    className="rounded-[26px] border border-brand-100/80 bg-white px-5 py-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-ink-950">{department.departmentName}</p>
                        <p className="mt-2 text-sm text-ink-700">{`총 ${department.totalCount}건 · 진행 ${department.inProgressCount}건`}</p>
                      </div>
                      <StatusPill tone={department.delayedCount > 0 ? "warning" : "success"}>
                        완료율 {completionRate}%
                      </StatusPill>
                    </div>

                    <div className="mt-4 h-2 rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-500),#93c5fd)]"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="danger">{`긴급 ${department.urgentCount}`}</Badge>
                      <Badge tone="warning">{`지연 ${department.delayedCount}`}</Badge>
                      <Badge tone="default">{`승인 대기 ${department.waitingApprovalCount}`}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </AppFrame>
  );
}
