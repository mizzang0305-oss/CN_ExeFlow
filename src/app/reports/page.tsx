import { AppFrame, Card, EmptyState, GenerateWeeklyReportButton, KpiCard } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { getReportsOverview } from "@/features/reports";
import { formatPercentLabel, formatWeekRangeLabel } from "@/lib";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await requireCurrentSession();

  let overview: Awaited<ReturnType<typeof getReportsOverview>> | null = null;
  let errorMessage: string | null = null;

  try {
    overview = await getReportsOverview(session);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "주간 결산을 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/reports"
      session={session}
      title="주간 결산"
      description="이번 주 운영 현황을 요약해서 보고, 누락 없이 주간 결산 기록을 쌓아갑니다."
    >
      {errorMessage || !overview ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">주간 결산을 불러오지 못했습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {overview.summaryCards.map((card) => (
              <KpiCard key={card.label} {...card} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="section-title">이번 주 요약</h2>
                  <p className="mt-1 text-sm text-ink-700">
                    같은 주차 중복 생성은 막고, 최신 결산 스냅샷을 기준으로 KPI를 노출합니다.
                  </p>
                </div>
                {overview.canGenerate ? <GenerateWeeklyReportButton /> : null}
              </div>

              {overview.latestReport ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-ink-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">주차</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">
                      {formatWeekRangeLabel(overview.latestReport.weekStart, overview.latestReport.weekEnd)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-ink-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">완료율</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">
                      {formatPercentLabel(overview.latestReport.completionRate)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-ink-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">기한 준수율</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">
                      {formatPercentLabel(overview.latestReport.onTimeCompletionRate)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-ink-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">생성 시각</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">
                      {new Date(overview.latestReport.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="아직 생성된 주간 결산이 없습니다"
                  description="이번 주 결산을 생성하면 최신 요약 카드와 기록 목록이 여기에 나타납니다."
                />
              )}
            </Card>

            <Card className="space-y-4">
              <div>
                <h2 className="section-title">결산 기록</h2>
                <p className="mt-1 text-sm text-ink-700">
                  최근 생성된 주간 결산을 시간순으로 확인할 수 있습니다.
                </p>
              </div>

              {overview.recentReports.length === 0 ? (
                <EmptyState
                  title="기록된 결산이 없습니다"
                  description="첫 결산이 생성되면 이곳에 주차별 기록이 쌓입니다."
                />
              ) : (
                <div className="space-y-3">
                  {overview.recentReports.map((report) => (
                    <div key={report.id} className="rounded-2xl border border-ink-200 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-950">
                          {formatWeekRangeLabel(report.weekStart, report.weekEnd)}
                        </p>
                        <p className="text-xs text-ink-500">{formatPercentLabel(report.completionRate)}</p>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-4">
                        <span>{`전체 ${report.totalCount}건`}</span>
                        <span>{`신규 ${report.newCount}건`}</span>
                        <span>{`지연 ${report.delayedCount}건`}</span>
                        <span>{`완료 ${report.completedCount}건`}</span>
                      </div>
                    </div>
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
