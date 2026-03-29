import Link from "next/link";

import { AppFrame, ApprovalQueueActions, Badge, Card, EmptyState } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { getDirectiveApprovalQueueForSession } from "@/features/directives";
import { formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

export default async function ApprovalQueuePage() {
  const session = await requireCurrentSession();

  let queue: Awaited<ReturnType<typeof getDirectiveApprovalQueueForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    queue = await getDirectiveApprovalQueueForSession(session);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "승인 대기 큐를 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/directives/approval-queue"
      session={session}
      title="승인 대기 큐"
      description="부서별 완료 요청을 모아 승인과 반려를 빠르게 처리하는 전용 화면입니다."
    >
      {errorMessage || !queue ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">승인 대기 큐를 불러오지 못했습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : queue.items.length === 0 ? (
        <EmptyState
          title="승인 대기 항목이 없습니다"
          description="현재 처리해야 할 부서별 완료 요청이 없습니다."
          action={
            <Link href="/directives" className="inline-flex items-center text-sm font-semibold text-brand-700">
              지시 목록으로 이동
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="default">{`총 ${queue.total}건`}</Badge>
            <Badge tone="warning">부서별 완료 요청 단위 처리</Badge>
          </div>

          <div className="grid gap-4">
            {queue.items.map((item) => (
              <Card key={`${item.directiveId}-${item.departmentId}`} className="space-y-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">승인 대기</Badge>
                      <Badge tone="muted">{item.directiveNo}</Badge>
                    </div>

                    <div>
                      <Link href={`/directives/${item.directiveId}`} className="text-lg font-semibold text-ink-950">
                        {item.title}
                      </Link>
                      <p className="mt-2 text-sm leading-6 text-ink-700">
                        요청 부서 {item.requestDepartmentName ?? "미지정"} · 요청자 {item.requesterName ?? "미확인"}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">요청 시간</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">
                          {formatDateTimeLabel(item.requestedAt)}
                        </p>
                        <p className="mt-1 text-xs text-ink-600">{formatRelativeUpdate(item.requestedAt)}</p>
                      </div>
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">로그 수</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">{item.logCount}건</p>
                      </div>
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">증빙 수</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">{item.attachmentCount}건</p>
                      </div>
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">결과 요약</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">
                          {item.requestReason ?? "요약 미입력"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="xl:min-w-[180px]">
                    <ApprovalQueueActions directiveId={item.directiveId} departmentId={item.departmentId} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AppFrame>
  );
}
