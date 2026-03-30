import Link from "next/link";

import {
  AppFrame,
  Badge,
  EmptyState,
  ErrorState,
  KpiCard,
  SectionCard,
  StatusPill,
  WorkflowActionPanel,
} from "@/components";
import { trackUserActivityAsync } from "@/features/activity";
import { requireDepartmentHeadSession } from "@/features/auth";
import { directiveLogTypeLabels, getDepartmentBoardData, type DirectiveListItem } from "@/features/directives";
import { formatDateLabel, formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

type AssigneeSignal = {
  assigneeName: string;
  completedCount: number;
  delayedCount: number;
  inProgressCount: number;
  lastActivityAt: string | null;
  missingEvidenceCount: number;
  noLogCount: number;
  totalCount: number;
  waitingApprovalCount: number;
};

function summarizeAssignees(items: DirectiveListItem[]): AssigneeSignal[] {
  const map = new Map<string, AssigneeSignal>();

  for (const item of items) {
    const key = item.ownerUserName ?? "담당자 미지정";
    const current = map.get(key) ?? {
      assigneeName: key,
      completedCount: 0,
      delayedCount: 0,
      inProgressCount: 0,
      lastActivityAt: null,
      missingEvidenceCount: 0,
      noLogCount: 0,
      totalCount: 0,
      waitingApprovalCount: 0,
    };

    current.totalCount += 1;
    current.completedCount += item.status === "COMPLETED" ? 1 : 0;
    current.delayedCount += item.isDelayed ? 1 : 0;
    current.inProgressCount += item.status === "IN_PROGRESS" ? 1 : 0;
    current.missingEvidenceCount += item.status !== "COMPLETED" && item.attachmentCount === 0 ? 1 : 0;
    current.noLogCount += item.status !== "COMPLETED" && item.logCount === 0 ? 1 : 0;
    current.waitingApprovalCount += item.status === "COMPLETION_REQUESTED" ? 1 : 0;

    if (!current.lastActivityAt) {
      current.lastActivityAt = item.lastActivityAt;
    } else if (item.lastActivityAt) {
      current.lastActivityAt =
        new Date(item.lastActivityAt).getTime() > new Date(current.lastActivityAt).getTime()
          ? item.lastActivityAt
          : current.lastActivityAt;
    }

    map.set(key, current);
  }

  return Array.from(map.values()).sort((left, right) => {
    const riskDelta =
      right.delayedCount +
      right.missingEvidenceCount +
      right.noLogCount -
      (left.delayedCount + left.missingEvidenceCount + left.noLogCount);

    if (riskDelta !== 0) {
      return riskDelta;
    }

    return right.totalCount - left.totalCount;
  });
}

function buildLowActivitySignals(signals: AssigneeSignal[]) {
  const staleThreshold = Date.now() - 72 * 60 * 60 * 1000;

  return signals
    .filter((signal) => {
      if (signal.noLogCount > 0 || signal.missingEvidenceCount > 0) {
        return true;
      }

      if (!signal.lastActivityAt) {
        return signal.totalCount > 0;
      }

      return new Date(signal.lastActivityAt).getTime() < staleThreshold;
    })
    .slice(0, 5);
}

export default async function DepartmentBoardPage() {
  const session = await requireDepartmentHeadSession("/board");

  let board: Awaited<ReturnType<typeof getDepartmentBoardData>> | null = null;
  let errorMessage: string | null = null;

  try {
    board = await getDepartmentBoardData(session);
    trackUserActivityAsync({
      activityType: "DEPARTMENT_BOARD_VIEW",
      pagePath: "/board",
      session,
      targetType: "dashboard",
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "부서 실행보드를 불러오지 못했습니다.";
  }

  if (errorMessage || !board) {
    return (
      <AppFrame
        currentPath="/board"
        session={session}
        title={`${session.departmentName ?? "부서"} 실행보드`}
        description="부서 단위 실행 흐름, 완료 요청, 지연과 증빙 부족 신호를 한 화면에서 관리합니다."
      >
        <ErrorState
          title="부서 실행보드를 불러오지 못했습니다"
          description={errorMessage ?? "잠시 후 다시 시도해주세요."}
        />
      </AppFrame>
    );
  }

  const assigneeSignals = summarizeAssignees(board.items);
  const lowActivitySignals = buildLowActivitySignals(assigneeSignals);
  const delayedItems = board.items.filter((item) => item.isDelayed).slice(0, 6);
  const requestableItems = board.items
    .filter((item) => item.currentDepartmentStatus === "IN_PROGRESS" || item.currentDepartmentStatus === "DELAYED")
    .slice(0, 4);
  const rejectedItems = board.items.filter((item) => item.currentDepartmentStatus === "REJECTED").slice(0, 4);

  return (
    <AppFrame
      currentPath="/board"
      enforceRoleHome
      session={session}
      title={`${session.departmentName ?? "부서"} 실행보드`}
      description="우리 부서 KPI, 담당자별 실행 현황, 완료 요청과 재진행 흐름을 한 번에 처리할 수 있게 정리했습니다."
    >
      <div className="space-y-6">
        <section className="panel-strong relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,130,237,0.14),transparent_30%)]" />
          <div className="relative grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="default">{session.departmentName ?? "우리 부서"}</StatusPill>
                <StatusPill tone="danger">{`증빙 보강 ${board.missingEvidenceItems.length}건`}</StatusPill>
                <StatusPill tone="warning">{`지연 ${delayedItems.length}건`}</StatusPill>
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-ink-950 sm:text-[2.1rem]">
                  우리 부서의 실행 현황과 완료 요청 흐름을 바로 점검하는 실행 보드
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-700">
                  누가 무엇을 맡고 있는지, 어떤 항목이 증빙 없이 남아 있는지, 어느 지시를 지금 완료 요청할 수 있는지
                  한눈에 볼 수 있게 구성했습니다.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { description: "긴급 우선 목록", href: "/directives?urgent=true", label: "긴급", value: board.urgentItems.length },
                  {
                    description: "승인 대기 항목",
                    href: "/directives?status=COMPLETION_REQUESTED",
                    label: "승인 대기",
                    value: board.waitingApprovalItems.length,
                  },
                  { description: "7일 내 마감", href: "/directives", label: "마감 임박", value: board.dueSoonItems.length },
                  { description: "저활동 신호", href: "/directives", label: "관리 신호", value: lowActivitySignals.length },
                ].map((item) => (
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
              <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-700 uppercase">오늘 우선순위</p>
              <div className="mt-4 space-y-3">
                {[
                  ["완료 요청 점검", `${requestableItems.length}건`, "로그, 증빙, 담당자 조건을 확인하고 완료 요청까지 이어갑니다."],
                  ["재진행 필요", `${rejectedItems.length}건`, "반려된 항목은 보완 후 재진행으로 전환해 흐름을 다시 살립니다."],
                  ["증빙 보강", `${board.missingEvidenceItems.length}건`, "증빙이 없는 로그는 승인 단계 전에 먼저 보강합니다."],
                ].map(([title, value, description]) => (
                  <div key={title} className="rounded-[24px] border border-white/70 bg-white/88 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ink-950">{title}</p>
                      <Badge tone="default">{value}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink-700">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {board.kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              {...kpi}
              href={
                kpi.label === "배정 건수"
                  ? "/directives"
                  : kpi.label === "진행 중"
                    ? "/directives?status=IN_PROGRESS"
                    : kpi.label === "승인 대기"
                      ? "/directives?status=COMPLETION_REQUESTED"
                      : kpi.label === "지연"
                        ? "/directives?status=DELAYED"
                        : "/directives"
              }
            />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <SectionCard
            accent="brand"
            title="완료 요청 / 재진행"
            description="부서장 전용 처리 구간입니다. 현재 상태에 따라 완료 요청 또는 재진행을 바로 실행할 수 있습니다."
          >
            {requestableItems.length === 0 && rejectedItems.length === 0 ? (
              <EmptyState
                title="처리할 상태 전환 항목이 없습니다"
                description="진행 중, 지연, 반려 상태의 현재 부서 지시가 생기면 여기에서 바로 처리할 수 있습니다."
              />
            ) : (
              <div className="space-y-4">
                {requestableItems.map((item) => (
                  <div key={`request-${item.id}`} className="rounded-[26px] border border-brand-100/80 bg-white px-5 py-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.currentDepartmentStatus === "DELAYED" ? "warning" : "default"}>
                            {item.currentDepartmentStatus === "DELAYED" ? "지연 상태" : "진행 중"}
                          </Badge>
                          <Badge tone="muted">{item.directiveNo}</Badge>
                        </div>
                        <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-700">
                          {item.ownerUserName ? `담당 ${item.ownerUserName}` : "담당자 미지정"} · 로그 {item.logCount}건 ·
                          증빙 {item.attachmentCount}건
                        </p>
                      </div>
                      <Link
                        href={`/directives/${item.id}`}
                        className="text-sm font-semibold text-brand-700"
                      >
                        상세 보기
                      </Link>
                    </div>

                    <div className="mt-4">
                      <WorkflowActionPanel
                        canRequestCompletion
                        departmentId={item.currentDepartmentId ?? session.departmentId!}
                        departmentLabel={session.departmentName ?? "현재 부서"}
                        directiveId={item.id}
                        helperText="완료 요청 전 로그 1건 이상, 증빙 1건 이상, 담당자 지정, 결과 요약 입력이 모두 필요합니다."
                      />
                    </div>
                  </div>
                ))}

                {rejectedItems.map((item) => (
                  <div key={`resume-${item.id}`} className="rounded-[26px] border border-warning-200/80 bg-white px-5 py-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warning">반려</Badge>
                          <Badge tone="muted">{item.directiveNo}</Badge>
                        </div>
                        <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-700">
                          보완 후 재진행으로 전환하면 다시 로그 등록과 완료 요청을 이어갈 수 있습니다.
                        </p>
                      </div>
                      <Link href={`/directives/${item.id}`} className="text-sm font-semibold text-brand-700">
                        상세 보기
                      </Link>
                    </div>

                    <div className="mt-4">
                      <WorkflowActionPanel
                        canResumeProgress
                        departmentId={item.currentDepartmentId ?? session.departmentId!}
                        departmentLabel={session.departmentName ?? "현재 부서"}
                        directiveId={item.id}
                        helperText="반려 사유를 보완한 뒤 재진행으로 전환해 흐름을 다시 시작합니다."
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            accent="brand"
            title="최근 활동 로그"
            description="최근 실행 로그는 텍스트가 흔들리지 않도록 정리했고, 클릭 시 해당 로그 위치로 바로 이동합니다."
            action={<Badge tone="default">{`${board.recentUpdates.length}건`}</Badge>}
          >
            {board.recentUpdates.length === 0 ? (
              <EmptyState
                title="최근 활동 로그가 없습니다"
                description="로그가 등록되면 여기에서 최신 실행 흐름을 바로 확인할 수 있습니다."
              />
            ) : (
              <div className="space-y-3">
                {board.recentUpdates.map((update) => (
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
                        {update.directiveNo} · {update.userName ?? "작성자 미확인"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            accent="brand"
            title="담당자 실행 현황"
            description="담당자별 배정 건수와 지연, 증빙 부족, 무로그 신호를 함께 묶어 바로 코칭할 수 있게 만들었습니다."
          >
            {assigneeSignals.length === 0 ? (
              <EmptyState
                title="담당자 현황이 없습니다"
                description="담당자가 연결된 지시가 생기면 이 영역에 요약이 표시됩니다."
              />
            ) : (
              <div className="space-y-3">
                {assigneeSignals.slice(0, 6).map((signal) => (
                  <div key={signal.assigneeName} className="rounded-[26px] border border-brand-100/80 bg-white px-5 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-ink-950">{signal.assigneeName}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-700">
                          총 {signal.totalCount}건 · 진행 {signal.inProgressCount}건 · 승인 대기 {signal.waitingApprovalCount}건
                        </p>
                      </div>
                      <StatusPill tone={signal.delayedCount > 0 || signal.noLogCount > 0 ? "warning" : "success"}>
                        {signal.lastActivityAt ? formatRelativeUpdate(signal.lastActivityAt) : "활동 없음"}
                      </StatusPill>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="warning">{`지연 ${signal.delayedCount}`}</Badge>
                      <Badge tone="danger">{`증빙 부족 ${signal.missingEvidenceCount}`}</Badge>
                      <Badge tone="muted">{`무로그 ${signal.noLogCount}`}</Badge>
                      <Badge tone="success">{`완료 ${signal.completedCount}`}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            accent="neutral"
            title="무로그 / 저활동 신호"
            description="로그가 없거나 최근 활동이 오래된 담당자를 먼저 보여줘 빠르게 코칭할 수 있게 했습니다."
          >
            {lowActivitySignals.length === 0 ? (
              <EmptyState
                title="저활동 신호가 없습니다"
                description="모든 담당자가 최근 로그와 증빙 흐름을 유지하고 있습니다."
              />
            ) : (
              <div className="space-y-3">
                {lowActivitySignals.map((signal) => (
                  <div key={signal.assigneeName} className="rounded-[26px] border border-ink-200/90 bg-white px-5 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-ink-950">{signal.assigneeName}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-700">
                          무로그 {signal.noLogCount}건 · 증빙 부족 {signal.missingEvidenceCount}건
                        </p>
                      </div>
                      <StatusPill tone={signal.noLogCount > 0 ? "warning" : "default"}>
                        {signal.lastActivityAt ? formatDateTimeLabel(signal.lastActivityAt) : "활동 기록 없음"}
                      </StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            accent="danger"
            title="증빙 부족 항목"
            description="로그는 남았지만 사진, 문서, 캡처 등 증빙이 부족한 지시를 먼저 모았습니다."
            action={<Badge tone="danger">{`${board.missingEvidenceItems.length}건`}</Badge>}
          >
            {board.missingEvidenceItems.length === 0 ? (
              <EmptyState
                title="증빙 부족 항목이 없습니다"
                description="현재 추가 증빙이 필요한 항목이 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {board.missingEvidenceItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="rounded-[26px] border border-danger-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,241,0.9))] px-5 py-5 shadow-[0_18px_38px_rgba(220,38,38,0.08)] transition hover:border-danger-300 hover:bg-danger-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger">증빙 보강 필요</Badge>
                      <Badge tone="muted">{item.directiveNo}</Badge>
                    </div>
                    <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      로그 {item.logCount}건 · 증빙 {item.attachmentCount}건 · 마감 {formatDateLabel(item.dueDate)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            accent="warning"
            title="지연 항목"
            description="마감이 지난 항목은 담당자와 최근 활동을 함께 보여줘 빠르게 후속 조치를 할 수 있게 했습니다."
            action={<Badge tone="warning">{`${delayedItems.length}건`}</Badge>}
          >
            {delayedItems.length === 0 ? (
              <EmptyState
                title="지연 항목이 없습니다"
                description="현재 마감이 지난 미완료 항목이 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {delayedItems.map((item) => (
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
                          담당 {item.ownerUserName ?? "미지정"} · 최근 활동 {formatRelativeUpdate(item.lastActivityAt)}
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
        </section>
      </div>
    </AppFrame>
  );
}
