import Link from "next/link";

import { AppFrame, Badge, Card, EmptyState, KpiCard } from "@/components";
import { requireExecutiveSession } from "@/features/auth";
import { getDashboardData } from "@/features/dashboard";
import { formatDateLabel, formatDateTimeLabel } from "@/lib";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireExecutiveSession();

  let dashboard: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let errorMessage: string | null = null;

  try {
    dashboard = await getDashboardData(session);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "대시보드를 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/dashboard"
      session={session}
      title="대표 대시보드"
      description="숫자와 상태를 먼저 보고, 긴급과 지연, 최근 업데이트를 30초 안에 파악할 수 있도록 구성했습니다."
    >
      {errorMessage || !dashboard ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">대시보드를 열 수 없습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {dashboard.kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">긴급 진행 중</h2>
                  <p className="mt-1 text-sm text-ink-700">
                    대표가 먼저 봐야 하는 긴급 지시사항을 상단에 고정했습니다.
                  </p>
                </div>
                <Badge tone="danger">{`${dashboard.urgentItems.length}건`}</Badge>
              </div>

              {dashboard.urgentItems.length === 0 ? (
                <EmptyState
                  title="진행 중인 긴급 건이 없습니다"
                  description="현재는 즉시 확인이 필요한 긴급 지시사항이 없습니다."
                />
              ) : (
                <div className="space-y-3">
                  {dashboard.urgentItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/directives/${item.id}`}
                      className="flex flex-col gap-2 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-ink-950">{item.title}</p>
                        <Badge tone="danger">{`L${item.urgentLevel ?? 1}`}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                        <span>{item.directiveNo}</span>
                        <span>{item.ownerDepartmentName ?? "미지정"}</span>
                        <span>{`마감 ${formatDateLabel(item.dueDate)}`}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div>
                <h2 className="section-title">확인 대기</h2>
                <p className="mt-1 text-sm text-ink-700">
                  완료 요청이 올라온 건은 여기서 먼저 파악합니다.
                </p>
              </div>
              {dashboard.waitingApprovalItems.length === 0 ? (
                <EmptyState
                  title="확인 대기 항목이 없습니다"
                  description="지금은 결재 또는 확인이 필요한 항목이 없습니다."
                />
              ) : (
                <div className="space-y-3">
                  {dashboard.waitingApprovalItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/directives/${item.id}`}
                      className="rounded-2xl bg-brand-50 px-4 py-4"
                    >
                      <p className="text-sm font-semibold text-ink-950">{item.title}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {item.directiveNo} · {item.ownerDepartmentName ?? "미지정"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">지연 건</h2>
                  <p className="mt-1 text-sm text-ink-700">마감이 지나 아직 완료되지 않은 항목입니다.</p>
                </div>
                <Badge tone="warning">{`${dashboard.delayedItems.length}건`}</Badge>
              </div>

              {dashboard.delayedItems.length === 0 ? (
                <EmptyState
                  title="지연 건이 없습니다"
                  description="현재는 마감이 지났지만 미완료인 항목이 없습니다."
                />
              ) : (
                <div className="space-y-3">
                  {dashboard.delayedItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/directives/${item.id}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-warning-100 px-4 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink-950">{item.title}</p>
                        <p className="mt-1 text-xs text-ink-500">
                          {item.directiveNo} · {item.ownerDepartmentName ?? "미지정"}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-warning-700">
                        {formatDateLabel(item.dueDate)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div>
                <h2 className="section-title">최근 업데이트</h2>
                <p className="mt-1 text-sm text-ink-700">
                  가장 최근 현장 행동이 어떤 내용이었는지 빠르게 확인합니다.
                </p>
              </div>

              {dashboard.recentUpdates.length === 0 ? (
                <EmptyState
                  title="최근 업데이트가 없습니다"
                  description="행동 로그가 쌓이면 여기에 최신 실행 흐름이 나타납니다."
                />
              ) : (
                <div className="space-y-3">
                  {dashboard.recentUpdates.map((update) => (
                    <Link
                      key={`${update.directiveId}-${update.happenedAt}`}
                      href={`/directives/${update.directiveId}`}
                      className="rounded-2xl border border-ink-200 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="muted">{update.logType}</Badge>
                        <span className="text-xs text-ink-500">
                          {formatDateTimeLabel(update.happenedAt)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink-950">{update.actionSummary}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {update.directiveNo} · {update.directiveTitle} · {update.userName ?? "작성자 미상"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>
      )}
    </AppFrame>
  );
}
