import Link from "next/link";

import { AppFrame, Badge, EmptyState, ErrorState, KpiCard, SectionCard, StatusPill } from "@/components";
import { requireDepartmentSession } from "@/features/auth";
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
  const session = await requireDepartmentSession();

  let board: Awaited<ReturnType<typeof getDepartmentBoardData>> | null = null;
  let errorMessage: string | null = null;

  try {
    board = await getDepartmentBoardData(session);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "부서 실행보드를 불러오지 못했습니다.";
  }

  if (errorMessage || !board) {
    return (
      <AppFrame
        currentPath="/board"
        session={session}
        title={`${session.departmentName ?? "부서"} 실행보드`}
        description="우리 부서의 실행 품질과 담당자 행동 신호를 바로 파악할 수 있는 실무 관제 화면입니다."
      >
        <ErrorState
          title="부서 실행보드를 열 수 없습니다"
          description={errorMessage ?? "부서 실행 현황을 다시 불러와 주세요."}
        />
      </AppFrame>
    );
  }

  const assigneeSignals = summarizeAssignees(board.items);
  const lowActivitySignals = buildLowActivitySignals(assigneeSignals);
  const delayedItems = board.items.filter((item) => item.isDelayed).slice(0, 6);

  return (
    <AppFrame
      currentPath="/board"
      session={session}
      title={`${session.departmentName ?? "부서"} 실행보드`}
      description="우리 부서 KPI, 담당자 실행 현황, 증빙 누락, 승인 대기, 지연 신호를 실무 조치 중심으로 재정렬했습니다."
    >
      <div className="space-y-6">
        <section className="panel-strong relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,130,237,0.14),transparent_30%)]" />
          <div className="relative grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="default">{session.departmentName ?? "우리 부서"}</StatusPill>
                <StatusPill tone="danger">{`증빙 누락 ${board.missingEvidenceItems.length}건`}</StatusPill>
                <StatusPill tone="warning">{`지연 ${delayedItems.length}건`}</StatusPill>
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-ink-950 sm:text-[2.1rem]">
                  우리 부서의 실행 품질과 담당자 리스크를 바로 확인하는 운영 보드
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-700">
                  누가 얼마나 배정받았는지, 누가 로그를 남기지 않았는지, 어떤 건이 증빙 없이 멈춰 있는지
                  바로 보이도록 실무 조치 중심으로 정리했습니다.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-[26px] border border-brand-100/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">Urgent</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-950">{board.urgentItems.length}</p>
                  <p className="mt-1 text-sm text-ink-700">긴급 우선 건</p>
                </div>
                <div className="rounded-[26px] border border-ink-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-600">Approval</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-950">{board.waitingApprovalItems.length}</p>
                  <p className="mt-1 text-sm text-ink-700">완료 요청 대기</p>
                </div>
                <div className="rounded-[26px] border border-ink-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-600">Due Soon</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-950">{board.dueSoonItems.length}</p>
                  <p className="mt-1 text-sm text-ink-700">7일 내 마감</p>
                </div>
                <div className="rounded-[26px] border border-ink-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_36px_rgba(3,19,38,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-600">Signals</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-950">{lowActivitySignals.length}</p>
                  <p className="mt-1 text-sm text-ink-700">저활동 시그널</p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-brand-100/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(238,244,255,0.84))] p-5 shadow-[0_26px_56px_rgba(3,19,38,0.09)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Today&apos;s Priorities</p>
              <div className="mt-4 space-y-3">
                {[
                  ["증빙 보강", `${board.missingEvidenceItems.length}건`, "로그는 있지만 증빙이 부족한 건부터 보강합니다."],
                  ["완료 요청 확인", `${board.waitingApprovalItems.length}건`, "승인 대기 건을 빠르게 위로 올려 흐름을 막지 않습니다."],
                  ["지연 조치", `${delayedItems.length}건`, "지연 신호가 난 건은 담당자와 마감일을 함께 확인합니다."],
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
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <SectionCard
            accent="brand"
            title="담당자 실행 현황"
            description="담당자별 배정 건수와 지연, 증빙 누락, 무로그 신호를 함께 보여 누구에게 조치가 필요한지 바로 식별합니다."
          >
            {assigneeSignals.length === 0 ? (
              <EmptyState
                title="담당자 실행 현황이 없습니다"
                description="담당자와 연결된 지시사항이 생기면 이곳에 실행 품질 신호가 나타납니다."
              />
            ) : (
              <div className="space-y-3">
                {assigneeSignals.slice(0, 6).map((signal) => (
                  <div key={signal.assigneeName} className="rounded-[26px] border border-brand-100/80 bg-white px-5 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-ink-950">{signal.assigneeName}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-700">
                          총 {signal.totalCount}건 · 진행 {signal.inProgressCount}건 · 승인 대기{" "}
                          {signal.waitingApprovalCount}건
                        </p>
                      </div>
                      <StatusPill tone={signal.delayedCount > 0 || signal.noLogCount > 0 ? "warning" : "success"}>
                        {signal.lastActivityAt ? formatRelativeUpdate(signal.lastActivityAt) : "활동 없음"}
                      </StatusPill>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="warning">{`지연 ${signal.delayedCount}`}</Badge>
                      <Badge tone="danger">{`증빙 누락 ${signal.missingEvidenceCount}`}</Badge>
                      <Badge tone="muted">{`무로그 ${signal.noLogCount}`}</Badge>
                      <Badge tone="success">{`완료 ${signal.completedCount}`}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            accent="brand"
            title="최근 행동 로그"
            description="우리 부서가 읽어야 할 최신 행동 흐름을 시간순으로 정리했습니다."
            action={<Badge tone="default">{`${board.recentUpdates.length}건`}</Badge>}
          >
            {board.recentUpdates.length === 0 ? (
              <EmptyState
                title="최근 행동 로그가 없습니다"
                description="로그가 쌓이면 이곳에서 최신 실행 흐름을 확인할 수 있습니다."
              />
            ) : (
              <div className="space-y-3">
                {board.recentUpdates.map((update) => (
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
                      {update.directiveNo} · {update.userName ?? "작성자 미확인"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            accent="danger"
            title="증빙 누락 건"
            description="행동은 시작됐지만 사진, 문서, 증빙이 부족한 항목을 먼저 끌어올렸습니다."
            action={<Badge tone="danger">{`${board.missingEvidenceItems.length}건`}</Badge>}
          >
            {board.missingEvidenceItems.length === 0 ? (
              <EmptyState
                title="증빙 누락 건이 없습니다"
                description="현재는 추가 증빙이 필요한 항목이 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {board.missingEvidenceItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="rounded-[26px] border border-danger-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,241,0.9))] px-5 py-5 shadow-[0_18px_38px_rgba(220,38,38,0.08)] transition hover:-translate-y-0.5"
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
            title="완료 요청 대기"
            description="우리 부서가 이미 움직였고 현재 승인만 기다리는 항목을 분리했습니다."
            action={<Badge tone="warning">{`${board.waitingApprovalItems.length}건`}</Badge>}
          >
            {board.waitingApprovalItems.length === 0 ? (
              <EmptyState
                title="완료 요청 대기 건이 없습니다"
                description="현재는 상위 승인만 기다리는 항목이 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {board.waitingApprovalItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="rounded-[26px] border border-warning-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,236,0.92))] px-5 py-5 transition hover:-translate-y-0.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">승인 대기</Badge>
                      <Badge tone="muted">{item.directiveNo}</Badge>
                    </div>
                    <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      완료 요청 {item.departmentProgress.COMPLETION_REQUESTED}곳 · 최근 활동{" "}
                      {formatRelativeUpdate(item.lastActivityAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            accent="warning"
            title="지연 건"
            description="누가 막혀 있는지 바로 보도록 마감일과 주관 담당자를 같이 붙였습니다."
            action={<Badge tone="warning">{`${delayedItems.length}건`}</Badge>}
          >
            {delayedItems.length === 0 ? (
              <EmptyState
                title="지연 건이 없습니다"
                description="현재 마감이 지난 미완료 항목이 없습니다."
              />
            ) : (
              <div className="space-y-3">
                {delayedItems.map((item) => (
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
                          담당 {item.ownerUserName ?? "미지정"} · 최근 활동 {formatRelativeUpdate(item.lastActivityAt)}
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
            accent="neutral"
            title="무로그 / 저활동 시그널"
            description="로그가 없거나 최근 활동이 오래된 담당자를 먼저 보여 빠른 코칭과 점검이 가능하게 했습니다."
          >
            {lowActivitySignals.length === 0 ? (
              <EmptyState
                title="저활동 시그널이 없습니다"
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
                          무로그 {signal.noLogCount}건 · 증빙 누락 {signal.missingEvidenceCount}건
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
      </div>
    </AppFrame>
  );
}
