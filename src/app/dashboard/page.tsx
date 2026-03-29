import Link from "next/link";

import { AppFrame, Badge, Card, EmptyState, KpiCard } from "@/components";
import { requireDashboardSession } from "@/features/auth";
import { getDashboardData } from "@/features/dashboard";
import { formatDateLabel, formatDateTimeLabel } from "@/lib";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireDashboardSession();

  let dashboard: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let errorMessage: string | null = null;

  try {
    dashboard = await getDashboardData(session);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "대시보드를 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/dashboard"
      session={session}
      title="대표 대시보드"
      description="지시 1건 기준 현황과 부서 이행 병목을 함께 봅니다. 숫자를 먼저 보고, 긴급 · 지연 · 승인대기 순으로 빠르게 판단할 수 있게 정리했습니다."
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

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">긴급 진행 중</h2>
                  <p className="mt-1 text-sm text-ink-700">
                    대표가 가장 먼저 봐야 하는 긴급 지시입니다. 지시 1건 아래에 몇 개 부서가 묶여 있는지도 같이 보여줍니다.
                  </p>
                </div>
                <Badge tone="danger">{`${dashboard.urgentItems.length}건`}</Badge>
              </div>

              {dashboard.urgentItems.length === 0 ? (
                <EmptyState
                  title="진행 중인 긴급 건이 없습니다"
                  description="현재 즉시 판단이 필요한 긴급 지시가 없습니다."
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
                        <span>{item.targetScope === "ALL" ? "전사 대상" : `${item.targetDepartmentCount}개 부서`}</span>
                        <span>{item.ownerDepartmentName ?? "주관 부서 미지정"}</span>
                        <span>{`마감 ${formatDateLabel(item.dueDate)}`}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div>
                <h2 className="section-title">승인 대기</h2>
                <p className="mt-1 text-sm text-ink-700">
                  지시 1건 기준으로 보고, 상세에서 어떤 부서가 승인 대기인지 드릴다운합니다.
                </p>
              </div>
              {dashboard.waitingApprovalItems.length === 0 ? (
                <EmptyState
                  title="승인 대기 항목이 없습니다"
                  description="지금은 확인 또는 결재가 필요한 항목이 없습니다."
                />
              ) : (
                <div className="space-y-3">
                  {dashboard.waitingApprovalItems.map((item) => (
                    <Link key={item.id} href={`/directives/${item.id}`} className="rounded-2xl bg-brand-50 px-4 py-4">
                      <p className="text-sm font-semibold text-ink-950">{item.title}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {item.directiveNo} · 대상 {item.targetDepartmentCount}개 부서 · 승인대기 {item.departmentProgress.COMPLETION_REQUESTED}곳
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
                  <p className="mt-1 text-sm text-ink-700">일부 부서라도 지연되면 여기에서 먼저 드러납니다.</p>
                </div>
                <Badge tone="warning">{`${dashboard.delayedItems.length}건`}</Badge>
              </div>

              {dashboard.delayedItems.length === 0 ? (
                <EmptyState
                  title="지연 건이 없습니다"
                  description="현재 마감이 지난 미완료 지시사항이 없습니다."
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
                          {item.directiveNo} · 대상 {item.targetDepartmentCount}개 부서 · 지연 {item.departmentProgress.DELAYED}곳
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-warning-700">{formatDateLabel(item.dueDate)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div>
                <h2 className="section-title">최근 업데이트</h2>
                <p className="mt-1 text-sm text-ink-700">
                  현장 행동 로그의 최신 흐름을 모아 보여줍니다.
                </p>
              </div>

              {dashboard.recentUpdates.length === 0 ? (
                <EmptyState
                  title="최근 업데이트가 없습니다"
                  description="행동 로그가 쌓이면 여기에서 최신 실행 흐름을 보여줍니다."
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
                        <span className="text-xs text-ink-500">{formatDateTimeLabel(update.happenedAt)}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink-950">{update.actionSummary}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {update.directiveNo} · {update.directiveTitle} · {update.userName ?? "작성자 미확인"}
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
