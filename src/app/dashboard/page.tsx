import Link from "next/link";

import { AppFrame, Badge, Card, KpiCard, SectionCard } from "@/components";
import { requireDashboardSession } from "@/features/auth";
import type { DirectiveListItem } from "@/features/directives";
import { directiveLogTypeLabels } from "@/features/directives";
import { getDashboardData } from "@/features/dashboard";
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

function ExecutivePriorityCard({
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
      className={`group rounded-[24px] border px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(18,24,38,0.08)] ${toneClassName}`}
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
          <span className={`h-3.5 w-3.5 rounded-full ${accentClassName}`} />
        </div>
        <div className="grid gap-2 text-sm text-ink-700 sm:grid-cols-2">{meta}</div>
      </div>
    </Link>
  );
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

  const kpiMap = new Map(dashboard?.kpis.map((kpi) => [kpi.label, kpi.value]) ?? []);
  const totalCount = kpiMap.get("전체 건수") ?? 0;
  const urgentCount = kpiMap.get("긴급") ?? 0;
  const delayedCount = kpiMap.get("지연") ?? 0;
  const waitingApprovalCount = dashboard?.waitingApprovalCount ?? 0;
  const latestUpdate = dashboard?.recentUpdates[0] ?? null;

  return (
    <AppFrame
      currentPath="/dashboard"
      session={session}
      title="대표 대시보드"
      description="숫자에서 위험과 승인대기까지 끊김 없이 읽히도록 전사 실행 화면을 재구성했습니다."
    >
      {errorMessage || !dashboard ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">대시보드를 열 수 없습니다</h2>
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
                      EXECUTIVE SNAPSHOT
                    </span>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <p className="text-5xl font-semibold tracking-[-0.05em]">{totalCount}</p>
                        <p className="pb-1 text-sm font-medium text-white/74">대표가 한 번에 보는 전사 지시 모수</p>
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        숫자부터 보고, 위험과 승인 대기를 바로 판단합니다.
                      </h2>
                      <p className="text-sm leading-7 text-white/78 sm:text-base">
                        긴급, 지연, 승인대기 흐름이 각기 다른 색과 카드 위계로 분리되어 의사결정이 필요한 건을 먼저 드러냅니다.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px] xl:grid-cols-2">
                    {[
                      { label: "긴급", tone: "text-danger-50", value: `${urgentCount}건` },
                      { label: "지연", tone: "text-warning-50", value: `${delayedCount}건` },
                      { label: "승인 대기", tone: "text-[#ffe6a3]", value: `${waitingApprovalCount}건` },
                      {
                        label: "최근 흐름",
                        tone: "text-white",
                        value: latestUpdate ? formatRelativeUpdate(latestUpdate.happenedAt) : "업데이트 없음",
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
                      label: "긴급 대응",
                      value: `${urgentCount}건`,
                      description: "대표가 먼저 봐야 하는 지시를 최상단 위험 카드로 고정했습니다.",
                    },
                    {
                      label: "승인 대기",
                      value: `${waitingApprovalCount}건`,
                      description: "결재 또는 승인 판단이 필요한 건을 별도 섹션으로 분리했습니다.",
                    },
                    {
                      label: "최근 업데이트",
                      value: latestUpdate ? formatDateTimeLabel(latestUpdate.happenedAt) : "-",
                      description: "최신 행동 로그를 읽기 쉬운 타임라인 스타일로 재정렬했습니다.",
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
              {dashboard.kpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </section>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <SectionCard
              eyebrow="RISK"
              title="긴급 대응"
              description="대표 판단이 먼저 필요한 긴급 지시입니다. 대상 범위와 주관 부서, 마감 시점을 한 번에 읽을 수 있게 정리했습니다."
              badge={<Badge tone="danger">{`${urgentCount}건`}</Badge>}
              contentClassName="gap-4"
            >
              {dashboard.urgentItems.length === 0 ? (
                <SectionEmpty
                  title="긴급 대응 건이 없습니다"
                  description="현재 즉시 판단이 필요한 긴급 지시가 없습니다."
                />
              ) : (
                dashboard.urgentItems.map((item) => (
                  <ExecutivePriorityCard
                    key={item.id}
                    item={item}
                    badgeTone="danger"
                    accentClassName="bg-danger-600"
                    toneClassName="border-danger-100 bg-[linear-gradient(180deg,#fff7f7_0%,#fff1f1_100%)]"
                    meta={
                      <>
                        <span>{`대상 ${item.targetScope === "ALL" ? "전사" : `${item.targetDepartmentCount}개 부서`}`}</span>
                        <span>{`주관 ${item.ownerDepartmentName ?? "미지정"}`}</span>
                        <span>{`마감 ${formatDateLabel(item.dueDate)}`}</span>
                        <span>{`승인대기 ${item.departmentProgress.COMPLETION_REQUESTED}곳`}</span>
                      </>
                    }
                  >
                    <Badge tone="danger">{`L${item.urgentLevel ?? 1}`}</Badge>
                  </ExecutivePriorityCard>
                ))
              )}
            </SectionCard>

            <SectionCard
              eyebrow="BOTTLENECK"
              title="지연 및 병목"
              description="지연 건은 마감과 병목 수를 함께 보여주고, 대표가 바로 우선순위를 조정할 수 있도록 강조했습니다."
              badge={<Badge tone="warning">{`${delayedCount}건`}</Badge>}
              contentClassName="gap-4"
            >
              {dashboard.delayedItems.length === 0 ? (
                <SectionEmpty title="지연 건이 없습니다" description="현재 마감이 지난 미완료 지시가 없습니다." />
              ) : (
                dashboard.delayedItems.map((item) => (
                  <ExecutivePriorityCard
                    key={item.id}
                    item={item}
                    badgeTone="warning"
                    accentClassName="bg-warning-600"
                    toneClassName="border-warning-100 bg-[linear-gradient(180deg,#fffdf8_0%,#fff6e7_100%)]"
                    meta={
                      <>
                        <span>{`마감 ${formatDateLabel(item.dueDate)}`}</span>
                        <span>{`지연 ${item.departmentProgress.DELAYED}곳`}</span>
                        <span>{`담당 ${item.ownerUserName ?? "미지정"}`}</span>
                        <span>{`최근 활동 ${formatRelativeUpdate(item.lastActivityAt)}`}</span>
                      </>
                    }
                  >
                    <Badge tone="warning">지연</Badge>
                  </ExecutivePriorityCard>
                ))
              )}
            </SectionCard>
          </section>

          <section>
            <SectionCard
              eyebrow="APPROVAL"
              title="승인 대기"
              description="완료 요청이 올라온 건만 따로 모아 결재 판단이 필요한 흐름을 빠르게 분리했습니다."
              badge={<Badge tone="warning">{`${waitingApprovalCount}건`}</Badge>}
              contentClassName="gap-4"
            >
              {dashboard.waitingApprovalItems.length === 0 ? (
                <SectionEmpty title="승인 대기 항목이 없습니다" description="지금은 결재 판단이 필요한 건이 없습니다." />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {dashboard.waitingApprovalItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/directives/${item.id}`}
                      className="rounded-[24px] border border-warning-100 bg-[linear-gradient(180deg,#fffbef_0%,#fff5d7_100%)] px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(180,83,9,0.12)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="warning">승인 대기</Badge>
                            <Badge tone="default">{item.directiveNo}</Badge>
                          </div>
                          <p className="text-base font-semibold tracking-tight text-ink-950">{item.title}</p>
                        </div>
                        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-warning-700">
                          {`${item.departmentProgress.COMPLETION_REQUESTED}곳 요청`}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-ink-700 sm:grid-cols-2">
                        <span>{`담당 ${item.ownerUserName ?? "미지정"}`}</span>
                        <span>{`주관 ${item.ownerDepartmentName ?? "미지정"}`}</span>
                        <span>{`대상 ${item.targetDepartmentCount}개 부서`}</span>
                        <span>{`최근 활동 ${formatRelativeUpdate(item.lastActivityAt)}`}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </section>

          <section>
            <SectionCard
              eyebrow="RECENT FLOW"
              title="최근 흐름"
              description="최신 행동 로그에서 누가 무엇을 했는지, 다음 액션이 무엇인지 한 줄씩 빠르게 읽을 수 있도록 가독성을 높였습니다."
              badge={<Badge tone="muted">{`${dashboard.recentUpdates.length}건`}</Badge>}
              contentClassName="gap-4"
            >
              {dashboard.recentUpdates.length === 0 ? (
                <SectionEmpty
                  title="최근 업데이트가 없습니다"
                  description="행동 로그가 쌓이면 이 영역에서 최신 흐름을 즉시 확인할 수 있습니다."
                />
              ) : (
                <div className="space-y-3">
                  {dashboard.recentUpdates.map((update) => (
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
                              {update.directiveNo} · {update.directiveTitle} · {update.userName ?? "작성자 미확인"}
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
