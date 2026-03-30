import Link from "next/link";

import { AppFrame, Badge, Button, Card, EmptyState, ErrorState } from "@/components";
import { trackUserActivityAsync } from "@/features/activity";
import { requireViewerSession } from "@/features/auth";
import { getViewerHomeData } from "@/features/dashboard";
import { formatDateLabel, formatPercentLabel } from "@/lib";

export const dynamic = "force-dynamic";

export default async function ViewerHomePage() {
  const session = await requireViewerSession("/viewer");

  let data: Awaited<ReturnType<typeof getViewerHomeData>> | null = null;
  let errorMessage: string | null = null;

  try {
    data = await getViewerHomeData(session);
    trackUserActivityAsync({
      activityType: "VIEWER_HOME_VIEW",
      pagePath: "/viewer",
      session,
      targetType: "dashboard",
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "조회 전용 홈을 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/viewer"
      description="조회 전용 사용자는 핵심 요약과 최근 지시를 안전하게 확인하고, 상세 화면에서 증빙과 상태를 읽기 전용으로 검토합니다."
      enforceRoleHome
      session={session}
      title="조회 홈"
    >
      {errorMessage || !data ? (
        <ErrorState title="조회 전용 홈을 불러오지 못했습니다." description={errorMessage ?? "잠시 후 다시 시도해주세요."} />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.summaryCards.map((card) => (
              <Card key={card.label} className="space-y-3">
                <Badge tone={card.tone === "muted" ? "default" : card.tone}>{card.label}</Badge>
                <p className="text-4xl font-semibold tracking-tight text-ink-950">{card.value}</p>
                {card.description ? <p className="text-sm leading-6 text-ink-700">{card.description}</p> : null}
              </Card>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="section-title">최근 지시</h2>
                  <p className="mt-1 text-sm text-ink-700">가장 최근의 지시를 빠르게 확인한 뒤 상세 화면으로 이동할 수 있습니다.</p>
                </div>
                <Link href="/directives">
                  <Button size="md" variant="secondary">
                    전체 지시 보기
                  </Button>
                </Link>
              </div>

              {data.recentDirectives.length === 0 ? (
                <EmptyState title="최근 지시가 없습니다." description="조회 가능한 지시가 생성되면 여기에 최신 항목이 표시됩니다." />
              ) : (
                <div className="space-y-3">
                  {data.recentDirectives.map((item) => (
                    <Link
                      key={item.id}
                      href={`/directives/${item.id}`}
                      className="block rounded-[24px] border border-ink-200/90 bg-white px-4 py-4 transition hover:border-brand-300 hover:bg-brand-50/35"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.isDelayed ? "danger" : item.status === "COMPLETION_REQUESTED" ? "warning" : "default"}>
                          {item.isDelayed ? "지연" : item.status === "COMPLETION_REQUESTED" ? "승인 대기" : "조회"}
                        </Badge>
                        <Badge tone="muted">{item.directiveNo}</Badge>
                      </div>
                      <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                      <p className="mt-2 text-sm text-ink-700">
                        {item.ownerDepartmentName ?? "미지정 부서"} · 마감 {formatDateLabel(item.dueDate)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div>
                <h2 className="section-title">주간 보고 요약</h2>
                <p className="mt-1 text-sm text-ink-700">최근 생성된 주간 보고를 읽기 전용으로 확인할 수 있습니다.</p>
              </div>

              {data.recentReports.length === 0 ? (
                <EmptyState title="주간 보고가 없습니다." description="주간 보고가 생성되면 여기에서 핵심 수치를 볼 수 있습니다." />
              ) : (
                <div className="space-y-3">
                  {data.recentReports.map((report) => (
                    <div key={report.id} className="rounded-[24px] border border-ink-200/90 bg-white px-4 py-4">
                      <p className="text-sm font-semibold text-ink-950">{`${report.weekStart} ~ ${report.weekEnd}`}</p>
                      <div className="mt-3 space-y-1 text-sm text-ink-700">
                        <p>{`완료율 ${formatPercentLabel(report.completionRate)}`}</p>
                        <p>{`기한 준수율 ${formatPercentLabel(report.onTimeCompletionRate)}`}</p>
                        <p>{`지연 ${report.delayedCount}건 · 완료 ${report.completedCount}건`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <Card className="space-y-4">
            <div>
              <h2 className="section-title">지연 항목</h2>
              <p className="mt-1 text-sm text-ink-700">조회 권한 안에서 현재 지연 중인 지시를 우선 확인합니다.</p>
            </div>

            {data.delayedItems.length === 0 ? (
              <EmptyState title="지연 항목이 없습니다." description="현재 조회 가능한 범위 안에 지연된 지시가 없습니다." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.delayedItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/directives/${item.id}`}
                    className="block rounded-[24px] border border-warning-200/85 bg-warning-50/55 px-4 py-4 transition hover:border-warning-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger">지연</Badge>
                      <Badge tone="muted">{item.directiveNo}</Badge>
                    </div>
                    <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
                    <p className="mt-2 text-sm text-ink-700">
                      {item.ownerDepartmentName ?? "미지정 부서"} · 마감 {formatDateLabel(item.dueDate)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </AppFrame>
  );
}
