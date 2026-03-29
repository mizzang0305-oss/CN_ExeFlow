import Link from "next/link";

import { AppFrame, Badge, Card, KpiCard, SectionCard } from "@/components";
import { requireDepartmentSession } from "@/features/auth";
import type { DepartmentBoardData, DirectiveListItem } from "@/features/directives";
import { directiveLogTypeLabels, getDepartmentBoardData } from "@/features/directives";
import { formatDateLabel, formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

function SectionEmpty({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-ink-200 bg-surface/80 px-5 py-6">
      <h3 className="text-sm font-semibold text-ink-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-700">{description}</p>
    </div>
  );
}

function BoardSignalCard({
  accentClassName,
  badgeTone,
  children,
  item,
  meta,
  toneClassName,
}: {
  accentClassName: string;
  badgeTone: "danger" | "default" | "muted" | "success" | "warning";
  children: React.ReactNode;
  item: DirectiveListItem;
  meta: React.ReactNode;
  toneClassName: string;
}) {
  return (
    <Link
      href={`/directives/${item.id}`}
      className={`rounded-[24px] border px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(18,24,38,0.08)] ${toneClassName}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={badgeTone}>{item.directiveNo}</Badge>
              {children}
            </div>
            <p className="text-base font-semibold tracking-tight text-ink-950">{item.title}</p>
          </div>
          <span className={`mt-1 h-3.5 w-3.5 rounded-full ${accentClassName}`} />
        </div>
        <div className="grid gap-2 text-sm text-ink-700 sm:grid-cols-2">{meta}</div>
      </div>
    </Link>
  );
}

function buildActionQueue(board: DepartmentBoardData) {
  const queue = new Map<
    string,
    {
      item: DirectiveListItem;
      priority: number;
      reason: string;
      tag: string;
      tone: "danger" | "default" | "muted" | "success" | "warning";
    }
  >();

  const candidates = [
    ...board.urgentItems.map((item) => ({
      item,
      priority: 0,
      reason: `긴급도 L${item.urgentLevel ?? 1} · ${formatRelativeUpdate(item.lastActivityAt)}`,
      tag: "긴급",
      tone: "danger" as const,
    })),
    ...board.waitingApprovalItems.map((item) => ({
      item,
      priority: 1,
      reason: `${item.departmentProgress.COMPLETION_REQUESTED}곳이 승인 요청 중`,
      tag: "완료요청 대기",
      tone: "warning" as const,
    })),
    ...board.dueSoonItems.map((item) => ({
      item,
      priority: 2,
      reason: `마감 ${formatDateLabel(item.dueDate)}`,
      tag: "마감 임박",
      tone: "default" as const,
    })),
  ];

  for (const candidate of candidates) {
    const existing = queue.get(candidate.item.id);

    if (!existing || candidate.priority < existing.priority) {
      queue.set(candidate.item.id, candidate);
    }
  }

  return Array.from(queue.values())
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return new Date(right.item.lastActivityAt).getTime() - new Date(left.item.lastActivityAt).getTime();
    })
    .slice(0, 6);
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

  const actionQueue = board ? buildActionQueue(board) : [];

  return (
    <AppFrame
      currentPath="/board"
      session={session}
      title={`${session.departmentName ?? "부서"} 실행보드`}
      description="우리 부서 KPI, 담당자 실행 품질, 누락과 지연, 조치 필요 항목을 한 번에 보는 부서장 전용 보드입니다."
    >
      {errorMessage || !board ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">부서 실행보드를 열 수 없습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-4">
            <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0c1f47_0%,#12306e_45%,#1c56b6_100%)] p-0 text-white shadow-[0_24px_60px_rgba(12,31,71,0.28)]">
              <div className="flex flex-col gap-8 px-6 py-7 sm:px-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl space-y-4">
                    <span className="inline-flex items-center rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/88">
                      DEPARTMENT SNAPSHOT
                    </span>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <p className="text-5xl font-semibold tracking-[-0.05em]">
                          {`${board.departmentSummary.completionRate}%`}
                        </p>
                        <p className="pb-1 text-sm font-medium text-white/74">우리 부서 완료율</p>
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        담당자 실행 품질과 누락 신호를 한 화면에서 바로 확인합니다.
                      </h2>
                      <p className="text-sm leading-7 text-white/78 sm:text-base">
                        부서 KPI와 담당자별 상태, 증빙 누락과 지연, 완료요청 대기와 최근 행동 로그를 같은 시선 흐름으로 배치했습니다.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
                    {[
                      {
                        label: "조치 필요",
                        tone: "text-danger-50",
                        value: `${board.departmentSummary.actionRequiredCount}건`,
                      },
                      {
                        label: "승인 대기",
                        tone: "text-[#ffe6a3]",
                        value: `${board.departmentSummary.waitingApprovalCount}건`,
                      },
                      {
                        label: "증빙 누락",
                        tone: "text-warning-50",
                        value: `${board.departmentSummary.missingEvidenceCount}건`,
                      },
                      {
                        label: "최근 활동",
                        tone: "text-white",
                        value: formatRelativeUpdate(board.departmentSummary.lastActivityAt),
                      },
                    ].map((signal) => (
                      <div
                        key={signal.label}
                        className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/58">{signal.label}</p>
                        <p className={`mt-3 text-lg font-semibold ${signal.tone}`}>{signal.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "배정 건수",
                      value: `${board.departmentSummary.totalCount}건`,
                      description: "우리 부서가 현재 관리해야 하는 전체 지시 모수입니다.",
                    },
                    {
                      label: "진행 중",
                      value: `${board.departmentSummary.inProgressCount}건`,
                      description: "담당자가 실제로 움직이고 있는 활성 지시 흐름입니다.",
                    },
                    {
                      label: "지연 신호",
                      value: `${board.departmentSummary.delayedCount}건`,
                      description: "마감이 늦어진 건을 별도 색상으로 분리해 즉시 보이게 했습니다.",
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-white/12 bg-black/10 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/58">{item.label}</p>
                      <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
                      <p className="mt-2 text-sm leading-6 text-white/72">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {board.kpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </section>
          </section>

          <section>
            <SectionCard
              eyebrow="OWNER VIEW"
              title="담당자 실행 현황"
              description="담당자별로 전체 건수와 실행 품질 신호를 함께 보여줘 누가 병목을 안고 있는지 바로 확인할 수 있습니다."
              badge={<Badge tone="default">{`${board.ownerInsights.length}명`}</Badge>}
              contentClassName="gap-4"
            >
              {board.ownerInsights.length === 0 ? (
                <SectionEmpty
                  title="담당자 현황이 없습니다"
                  description="배정된 담당자 정보가 쌓이면 여기에서 실행 품질을 확인할 수 있습니다."
                />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {board.ownerInsights.map((owner) => {
                    const completionRate =
                      owner.totalCount > 0 ? Math.round((owner.completedCount / owner.totalCount) * 100) : 0;

                    return (
                      <div
                        key={`${owner.ownerUserId ?? owner.name}-${owner.lastActivityAt ?? "none"}`}
                        className="rounded-[24px] border border-ink-200 bg-white px-5 py-5 shadow-[0_12px_28px_rgba(18,24,38,0.04)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={owner.qualityTone}>{owner.qualityLabel}</Badge>
                              <span className="text-xs font-medium text-ink-500">
                                {formatRelativeUpdate(owner.lastActivityAt)}
                              </span>
                            </div>
                            <div>
                              <p className="text-base font-semibold tracking-tight text-ink-950">{owner.name}</p>
                              <p className="mt-1 text-sm text-ink-600">{owner.title ?? "담당 직책 미등록"}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">완료율</p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-brand-950">{`${completionRate}%`}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-surface px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">전체 건수</p>
                            <p className="mt-2 text-lg font-semibold text-ink-950">{owner.totalCount}</p>
                          </div>
                          <div className="rounded-2xl bg-surface px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">진행 중</p>
                            <p className="mt-2 text-lg font-semibold text-ink-950">{owner.inProgressCount}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge tone="warning">{`지연 ${owner.delayedCount}`}</Badge>
                          <Badge tone="danger">{`증빙 누락 ${owner.missingEvidenceCount}`}</Badge>
                          <Badge tone="default">{`승인 대기 ${owner.waitingApprovalCount}`}</Badge>
                          {owner.urgentCount > 0 ? <Badge tone="danger">{`긴급 ${owner.urgentCount}`}</Badge> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <SectionCard
              eyebrow="MISSING"
              title="증빙 누락"
              description="로그는 있지만 증빙이 부족한 건을 별도 컬러로 묶어 부서장이 바로 보강 요청할 수 있게 했습니다."
              badge={<Badge tone="danger">{`${board.departmentSummary.missingEvidenceCount}건`}</Badge>}
              contentClassName="gap-4"
            >
              {board.missingEvidenceItems.length === 0 ? (
                <SectionEmpty
                  title="증빙 누락 건이 없습니다"
                  description="현재는 증빙을 추가로 보강해야 할 항목이 없습니다."
                />
              ) : (
                board.missingEvidenceItems.map((item) => (
                  <BoardSignalCard
                    key={item.id}
                    item={item}
                    badgeTone="danger"
                    accentClassName="bg-danger-600"
                    toneClassName="border-danger-100 bg-[linear-gradient(180deg,#fff8f8_0%,#fff2f2_100%)]"
                    meta={
                      <>
                        <span>{`로그 ${item.logCount}건`}</span>
                        <span>{`증빙 ${item.attachmentCount}건`}</span>
                        <span>{`담당 ${item.ownerUserName ?? "미지정"}`}</span>
                        <span>{`최근 활동 ${formatRelativeUpdate(item.lastActivityAt)}`}</span>
                      </>
                    }
                  >
                    <Badge tone="warning">증빙 보강</Badge>
                  </BoardSignalCard>
                ))
              )}
            </SectionCard>

            <SectionCard
              eyebrow="DELAY"
              title="지연"
              description="지연 건은 마감일과 담당자, 최근 활동 시점을 함께 보여 줘 개입 우선순위를 빠르게 정할 수 있게 했습니다."
              badge={<Badge tone="warning">{`${board.departmentSummary.delayedCount}건`}</Badge>}
              contentClassName="gap-4"
            >
              {board.delayedItems.length === 0 ? (
                <SectionEmpty title="지연 건이 없습니다" description="현재 지연된 지시 항목이 없습니다." />
              ) : (
                board.delayedItems.map((item) => (
                  <BoardSignalCard
                    key={item.id}
                    item={item}
                    badgeTone="warning"
                    accentClassName="bg-warning-600"
                    toneClassName="border-warning-100 bg-[linear-gradient(180deg,#fffdf8_0%,#fff6e7_100%)]"
                    meta={
                      <>
                        <span>{`마감 ${formatDateLabel(item.dueDate)}`}</span>
                        <span>{`담당 ${item.ownerUserName ?? "미지정"}`}</span>
                        <span>{`긴급 ${item.isUrgent ? "예" : "아니오"}`}</span>
                        <span>{`최근 활동 ${formatRelativeUpdate(item.lastActivityAt)}`}</span>
                      </>
                    }
                  >
                    <Badge tone="warning">지연</Badge>
                  </BoardSignalCard>
                ))
              )}
            </SectionCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              eyebrow="ACTION REQUIRED"
              title="조치 필요"
              description="긴급, 완료요청 대기, 마감 임박 건을 한 큐로 묶어 부서장이 바로 지시할 수 있게 우선순위를 붙였습니다."
              badge={<Badge tone="warning">{`${actionQueue.length}건`}</Badge>}
              contentClassName="gap-4"
            >
              {actionQueue.length === 0 ? (
                <SectionEmpty
                  title="즉시 조치할 항목이 없습니다"
                  description="현재는 긴급, 승인 대기, 마감 임박 건이 비어 있습니다."
                />
              ) : (
                actionQueue.map((queueItem) => (
                  <Link
                    key={`${queueItem.tag}-${queueItem.item.id}`}
                    href={`/directives/${queueItem.item.id}`}
                    className="rounded-[24px] border border-ink-200 bg-white px-5 py-5 transition hover:border-brand-100 hover:bg-brand-50/35 hover:shadow-[0_18px_36px_rgba(18,24,38,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={queueItem.tone}>{queueItem.tag}</Badge>
                          <Badge tone="default">{queueItem.item.directiveNo}</Badge>
                        </div>
                        <p className="text-base font-semibold tracking-tight text-ink-950">{queueItem.item.title}</p>
                        <p className="text-sm leading-6 text-ink-700">{queueItem.reason}</p>
                      </div>
                      <span className="text-sm font-medium text-ink-500">{formatDateLabel(queueItem.item.dueDate)}</span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-ink-700 sm:grid-cols-2">
                      <span>{`담당 ${queueItem.item.ownerUserName ?? "미지정"}`}</span>
                      <span>{`대상 ${queueItem.item.targetDepartmentCount}개 부서`}</span>
                    </div>
                  </Link>
                ))
              )}
            </SectionCard>

            <SectionCard
              eyebrow="RECENT LOG"
              title="최근 행동 로그"
              description="누가 무엇을 했는지, 다음 액션과 리스크가 무엇인지 한 번에 읽히도록 로그 가독성을 높였습니다."
              badge={<Badge tone="muted">{`${board.recentUpdates.length}건`}</Badge>}
              contentClassName="gap-4"
            >
              {board.recentUpdates.length === 0 ? (
                <SectionEmpty
                  title="최근 행동 로그가 없습니다"
                  description="행동 로그가 쌓이면 이 영역에 최신 실행 흐름이 바로 보입니다."
                />
              ) : (
                <div className="space-y-3">
                  {board.recentUpdates.map((update) => (
                    <Link
                      key={`${update.directiveId}-${update.happenedAt}`}
                      href={`/directives/${update.directiveId}`}
                      className="rounded-[24px] border border-ink-200 bg-white px-5 py-5 transition hover:border-brand-100 hover:bg-brand-50/35 hover:shadow-[0_18px_36px_rgba(18,24,38,0.06)]"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="muted">{directiveLogTypeLabels[update.logType]}</Badge>
                            {update.departmentName ? <Badge tone="default">{update.departmentName}</Badge> : null}
                            <span className="text-xs font-medium text-ink-500">{formatRelativeUpdate(update.happenedAt)}</span>
                          </div>
                          <div className="space-y-2">
                            <p className="text-base font-semibold tracking-tight text-ink-950">{update.actionSummary}</p>
                            <p className="text-sm leading-6 text-ink-700">
                              {update.directiveNo} · {update.userName ?? "작성자 미확인"} · {update.directiveTitle}
                            </p>
                            {update.nextAction ? (
                              <p className="text-sm leading-6 text-brand-900">{`다음 조치: ${update.nextAction}`}</p>
                            ) : null}
                            {update.riskNote ? (
                              <p className="text-sm leading-6 text-warning-700">{`리스크: ${update.riskNote}`}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-2xl bg-surface px-4 py-3 text-sm font-medium text-ink-700">
                          {formatDateTimeLabel(update.happenedAt)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </section>
        </div>
      )}
    </AppFrame>
  );
}
