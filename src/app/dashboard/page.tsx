import Link from "next/link";

import { AppFrame, Badge, EmptyState, ErrorState, KpiCard, SectionCard, StatusPill } from "@/components";
import { requireDashboardSession } from "@/features/auth";
import { directiveLogTypeLabels, getDashboardData, type DirectiveListItem } from "@/features/directives";
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
      const riskDelta =
        right.urgentCount +
        right.delayedCount +
        right.waitingApprovalCount -
        (left.urgentCount + left.delayedCount + left.waitingApprovalCount);

      if (riskDelta !== 0) {
        return riskDelta;
      }

      return right.totalCount - left.totalCount;
    })
    .slice(0, 6);
}

export default async function DashboardPage() {
  const session = await requireDashboardSession();

  let dashboard: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let errorMessage: string | null = null;

  try {
    dashboard = await getDashboardData(session);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "대시보드를 불러오지 못했습니다.";
  }

  if (errorMessage || !dashboard) {
    return (
      <AppFrame
        currentPath="/dashboard"
        session={session}
        title="대표 대시보드"
        description="숫자와 리스크를 가장 먼저 보고, 지연과 승인 대기를 빠르게 판단할 수 있는 운영 관제 화면입니다."
      >
        <ErrorState
          title="대표 대시보드를 열 수 없습니다"
          description={errorMessage ?? "운영 현황을 다시 불러와 주세요."}
        />
      </AppFrame>
    );
  }

  const departmentSummaries = summarizeDepartments(dashboard.items);
  const priorityCount = dashboard.urgentItems.length + dashboard.waitingApprovalItems.length;

  return (
    <AppFrame
      currentPath="/dashboard"
      session={session}
      title="대표 대시보드"
      description="숫자, 승인 대기, 지연 리스크를 한 흐름으로 보고 즉시 판단할 수 있도록 대표 관점으로 재정렬했습니다."
    >
      <div className="space-y-6">
        <section className="panel-strong relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,130,237,0.14),transparent_30%)]" />
          <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="default">대표 운영 관제</StatusPill>
                <StatusPill tone="danger">{`긴급 ${dashboard.urgentItems.length}건`}</StatusPill>
                <StatusPill tone="warning">{`지연 ${dashboard.delayedItems.length}건`}</StatusPill>
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-ink-950 sm:text-[2.2rem]">
                  실행 속도와 통제 신호를 같은 시야에 두는 CEO 운영 뷰
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-700">
                  먼저 숫자를 보고, 다음으로 긴급 건과 승인 대기, 그다음 지연 흐름과 최근 업데이트를
                  확인하도록 정보 계층을 조정했습니다.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-[26px] border border-brand-100/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">Immediate</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-950">{priorityCount}</p>
                  <p className="mt-1 text-sm text-ink-700">즉시 판단 필요 건</p>
                </div>
                <div className="rounded-[26px] border border-ink-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-600">Approval</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-950">{dashboard.waitingApprovalItems.length}</p>
                  <p className="mt-1 text-sm text-ink-700">승인 대기 라인</p>
                </div>
                <div className="rounded-[26px] border border-ink-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-600">Risk</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-950">{dashboard.delayedItems.length}</p>
                  <p className="mt-1 text-sm text-ink-700">지연 감시 건</p>
                </div>
                <div className="rounded-[26px] border border-ink-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-600">Flow</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-950">{dashboard.recentUpdates.length}</p>
                  <p className="mt-1 text-sm text-ink-700">최근 실행 업데이트</p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-brand-100/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(238,244,255,0.84))] p-5 shadow-[0_26px_56px_rgba(3,19,38,0.09)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Executive Flow</p>
              <div className="mt-4 space-y-3">
                {[
                  ["숫자 보기", "전체 · 진행 · 지연 · 완료 · 긴급 KPI로 운영 속도를 확인합니다."],
                  ["긴급 확인", "대표가 바로 열어야 하는 긴급 건을 첫 번째 레이어에 배치했습니다."],
                  ["승인 판단", "완료 요청 대기를 별도 섹션으로 묶어 결재 흐름을 분리했습니다."],
                  ["리스크 감시", "지연 건과 최근 업데이트를 운영 리스크 뷰로 분리했습니다."],
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {dashboard.kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.16fr_0.84fr]">
          <SectionCard
            accent="danger"
            title="대표 우선 확인"
            description="긴급 레벨과 마감일, 주관 부서를 함께 보여 즉시 판단이 필요한 건을 가장 먼저 보이게 했습니다."
            action={<Badge tone="danger">{`${dashboard.urgentItems.length}건`}</Badge>}
          >
            {dashboard.urgentItems.length === 0 ? (
              <EmptyState
                title="긴급 진행 중 건이 없습니다"
                description="즉시 판단이 필요한 긴급 실행 건이 현재는 없습니다."
              />
            ) : (
              <div className="grid gap-3">
                {dashboard.urgentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="group rounded-[28px] border border-danger-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,241,0.9))] px-5 py-5 shadow-[0_18px_42px_rgba(220,38,38,0.08)] transition hover:-translate-y-1"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="danger">{`L${item.urgentLevel ?? 1}`}</Badge>
                          <Badge tone="muted">{item.directiveNo}</Badge>
                          <Badge tone="warning">{`마감 ${formatDateLabel(item.dueDate)}`}</Badge>
                        </div>
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-ink-950">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-ink-700">
                            {item.targetScope === "ALL" ? "전사 대상" : `대상 ${item.targetDepartmentCount}개 부서`} · 주관{" "}
                            {item.ownerDepartmentName ?? "미지정"}
                            {item.ownerUserName ? ` · 담당 ${item.ownerUserName}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-danger-200/70 bg-white/82 px-4 py-3 text-sm text-ink-700">
                        <p className="font-semibold text-danger-700">{`지연 부서 ${item.departmentProgress.DELAYED}곳`}</p>
                        <p className="mt-1">{`승인 대기 ${item.departmentProgress.COMPLETION_REQUESTED}곳`}</p>
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
            description="대표 승인 또는 최종 확인이 필요한 완료 요청 건만 분리해 결재 라인을 선명하게 보이게 했습니다."
            action={<Badge tone="warning">{`${dashboard.waitingApprovalItems.length}건`}</Badge>}
          >
            {dashboard.waitingApprovalItems.length === 0 ? (
              <EmptyState
                title="승인 대기 항목이 없습니다"
                description="지금은 대표 확인이 필요한 완료 요청 항목이 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.waitingApprovalItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="rounded-[26px] border border-warning-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,236,0.92))] px-5 py-5 shadow-[0_18px_38px_rgba(217,119,6,0.08)] transition hover:-translate-y-0.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">승인 대기</Badge>
                      <Badge tone="muted">{item.directiveNo}</Badge>
                    </div>
                    <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      대상 {item.targetDepartmentCount}개 부서 · 완료 요청 {item.departmentProgress.COMPLETION_REQUESTED}곳
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
            description="지연 신호가 난 건을 우선순위 높은 리스트로 정리해 리스크 레이어를 별도로 만들었습니다."
            action={<Badge tone="warning">{`${dashboard.delayedItems.length}건`}</Badge>}
          >
            {dashboard.delayedItems.length === 0 ? (
              <EmptyState
                title="지연 리스크가 없습니다"
                description="현재 마감이 지난 미완료 지시사항이 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.delayedItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="rounded-[26px] border border-warning-200/80 bg-white px-5 py-5 transition hover:-translate-y-0.5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warning">지연</Badge>
                          <Badge tone="muted">{item.directiveNo}</Badge>
                        </div>
                        <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-700">
                          주관 {item.ownerDepartmentName ?? "미지정"} · 지연 부서 {item.departmentProgress.DELAYED}곳
                        </p>
                      </div>
                      <div className="rounded-[20px] bg-warning-50 px-4 py-3 text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warning-700">Due</p>
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
            description="최근 실행 흐름을 텍스트 밀도 낮춘 타임라인 구조로 정리해 빠르게 읽히도록 했습니다."
            action={<Badge tone="default">{`${dashboard.recentUpdates.length}건`}</Badge>}
          >
            {dashboard.recentUpdates.length === 0 ? (
              <EmptyState
                title="최근 업데이트가 없습니다"
                description="실행 로그가 쌓이면 여기에서 최신 흐름을 확인할 수 있습니다."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.recentUpdates.map((update) => (
                  <Link
                    key={`${update.directiveId}-${update.happenedAt}`}
                    href={`/directives/${update.directiveId}`}
                    className="rounded-[26px] border border-brand-100/80 bg-white px-5 py-5 transition hover:-translate-y-0.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="default">{directiveLogTypeLabels[update.logType]}</Badge>
                      <span className="text-xs font-medium text-ink-500">
                        {formatDateTimeLabel(update.happenedAt)} · {formatRelativeUpdate(update.happenedAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-base font-semibold text-ink-950">{update.actionSummary}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      {update.directiveNo} · {update.directiveTitle}
                      {update.userName ? ` · ${update.userName}` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <SectionCard
          accent="brand"
          title="부서별 이행 현황"
          description="주관 부서 기준으로 어느 조직에서 긴급, 승인 대기, 지연 신호가 모이는지 한 번에 보이도록 요약했습니다."
        >
          {departmentSummaries.length === 0 ? (
            <EmptyState
              title="집계할 부서 현황이 없습니다"
              description="주관 부서가 연결된 지시사항이 생기면 이곳에 부서별 요약이 나타납니다."
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
