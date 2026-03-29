import Link from "next/link";

import { AppFrame, Badge, Card, EmptyState, KpiCard } from "@/components";
import { requireDepartmentSession } from "@/features/auth";
import { getDepartmentBoardData } from "@/features/directives";
import { formatDateLabel, formatDateTimeLabel } from "@/lib";

export const dynamic = "force-dynamic";

export default async function DepartmentBoardPage() {
  const session = await requireDepartmentSession();

  let board: Awaited<ReturnType<typeof getDepartmentBoardData>> | null = null;
  let errorMessage: string | null = null;

  try {
    board = await getDepartmentBoardData(session);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "부서 실행보드를 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/board"
      session={session}
      title={`${session.departmentName ?? "부서"} 실행보드`}
      description="우리 부서가 지금 당장 실행해야 하는 지시사항과 증빙 누락, 승인 대기 건을 한 화면에서 봅니다."
    >
      {errorMessage || !board ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">부서 실행보드를 열 수 없습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {board.kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">긴급 우선</h2>
                  <p className="mt-1 text-sm text-ink-700">모바일에서도 가장 먼저 눌러야 할 긴급 건입니다.</p>
                </div>
                <Badge tone="danger">{`${board.urgentItems.length}건`}</Badge>
              </div>

              {board.urgentItems.length === 0 ? (
                <EmptyState title="긴급 건이 없습니다" description="현재 긴급 지시사항은 없습니다." />
              ) : (
                <div className="space-y-3">
                  {board.urgentItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/directives/${item.id}`}
                      className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-4"
                    >
                      <p className="text-sm font-semibold text-ink-950">{item.title}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {item.directiveNo} · 마감 {formatDateLabel(item.dueDate)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">증빙 필요</h2>
                  <p className="mt-1 text-sm text-ink-700">행동은 시작됐지만 사진이나 문서가 아직 없는 건입니다.</p>
                </div>
                <Badge tone="warning">{`${board.missingEvidenceItems.length}건`}</Badge>
              </div>

              {board.missingEvidenceItems.length === 0 ? (
                <EmptyState title="증빙 누락 건이 없습니다" description="현재는 증빙을 더 보강할 항목이 없습니다." />
              ) : (
                <div className="space-y-3">
                  {board.missingEvidenceItems.map((item) => (
                    <Link key={item.id} href={`/directives/${item.id}`} className="rounded-2xl bg-warning-100 px-4 py-4">
                      <p className="text-sm font-semibold text-ink-950">{item.title}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {item.directiveNo} · 로그 {item.logCount}건 · 증빙 {item.attachmentCount}건
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">마감 임박</h2>
                  <p className="mt-1 text-sm text-ink-700">7일 안에 마감되는 건을 빠르게 확인합니다.</p>
                </div>
                <Badge tone="default">{`${board.dueSoonItems.length}건`}</Badge>
              </div>

              {board.dueSoonItems.length === 0 ? (
                <EmptyState title="마감 임박 건이 없습니다" description="이번 주에 급하게 마감되는 건은 없습니다." />
              ) : (
                <div className="space-y-3">
                  {board.dueSoonItems.map((item) => (
                    <Link key={item.id} href={`/directives/${item.id}`} className="rounded-2xl border border-ink-200 px-4 py-4">
                      <p className="text-sm font-semibold text-ink-950">{item.title}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {item.directiveNo} · 마감 {formatDateLabel(item.dueDate)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">부서 최근 업데이트</h2>
                  <p className="mt-1 text-sm text-ink-700">실무자가 남긴 최근 행동 흐름입니다.</p>
                </div>
                <Badge tone="muted">{`${board.recentUpdates.length}건`}</Badge>
              </div>

              {board.recentUpdates.length === 0 ? (
                <EmptyState title="최근 업데이트가 없습니다" description="로그가 쌓이면 여기에서 최신 실행 내용을 확인할 수 있습니다." />
              ) : (
                <div className="space-y-3">
                  {board.recentUpdates.map((update) => (
                    <Link key={`${update.directiveId}-${update.happenedAt}`} href={`/directives/${update.directiveId}`} className="rounded-2xl border border-ink-200 px-4 py-4">
                      <p className="text-sm font-semibold text-ink-950">{update.actionSummary}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {update.directiveNo} · {formatDateTimeLabel(update.happenedAt)} · {update.userName ?? "작성자 미확인"}
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
