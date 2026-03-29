import Link from "next/link";

import { AppFrame, Badge, Button, Card, EmptyState } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import {
  activityPaginationQuerySchema,
  listNotificationLogsForSession,
  notificationChannelLabels,
  notificationDeliveryStatusLabels,
  notificationTypeLabels,
} from "@/features/activity";
import { formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

type NotificationLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NotificationLogsPage({ searchParams }: NotificationLogsPageProps) {
  const session = await requireCurrentSession();
  const params = await searchParams;
  const parsed = activityPaginationQuerySchema.safeParse({
    page: readSingleValue(params.page),
    pageSize: readSingleValue(params.pageSize),
    search: readSingleValue(params.search),
  });
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 30, search: undefined };

  let result: Awaited<ReturnType<typeof listNotificationLogsForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    result = await listNotificationLogsForSession(session, filters);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "알림 로그를 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/admin/notification-logs"
      session={session}
      title="알림 로그"
      description="지시 배정, 완료 요청, 승인 요청, 승인 완료, 반려, 지연 발생 알림의 발송·읽음·클릭 이력을 조회합니다."
    >
      {errorMessage || !result ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">알림 로그를 불러오지 못했습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="default">{`총 ${result.pagination.total}건`}</Badge>
                  <Badge tone="muted">푸시 큐 및 열람 이력</Badge>
                </div>
                <p className="text-sm text-ink-700">
                  실제 발송과 별개로 경영 판단에 필요한 알림 이력을 일관되게 남깁니다.
                </p>
              </div>

              <form className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  name="search"
                  defaultValue={filters.search}
                  placeholder="제목 또는 알림 유형 검색"
                  className="field min-w-[240px]"
                />
                <Button type="submit" size="md">
                  적용
                </Button>
              </form>
            </div>
          </Card>

          {result.items.length === 0 ? (
            <EmptyState
              title="알림 로그가 없습니다"
              description="현재 권한 범위에서 조회되는 알림 로그가 없습니다."
            />
          ) : (
            <div className="grid gap-4">
              {result.items.map((item) => (
                <Card key={item.id} className="space-y-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="default">{notificationTypeLabels[item.notificationType]}</Badge>
                        <Badge tone="muted">{notificationChannelLabels[item.channel]}</Badge>
                        <Badge tone={item.deliveryStatus === "FAILED" ? "danger" : item.deliveryStatus === "READ" ? "success" : "warning"}>
                          {notificationDeliveryStatusLabels[item.deliveryStatus]}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-ink-950">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-700">{item.body}</p>
                        <p className="mt-2 text-sm text-ink-600">
                          {item.user?.displayName ?? "미확인 사용자"}
                          {item.directiveNo ? ` · ${item.directiveNo}` : ""}
                          {item.directiveTitle ? ` · ${item.directiveTitle}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">발송 시각</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">{formatDateTimeLabel(item.sentAt)}</p>
                        <p className="mt-1 text-xs text-ink-600">{formatRelativeUpdate(item.sentAt)}</p>
                      </div>
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">읽음 시각</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">
                          {item.readAt ? formatDateTimeLabel(item.readAt) : "미처리"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">클릭 시각</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">
                          {item.clickedAt ? formatDateTimeLabel(item.clickedAt) : "미처리"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">대상</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">
                          {item.user?.departmentName ?? "부서 미지정"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {Object.keys(item.metadata).length > 0 ? (
                    <div className="rounded-2xl border border-ink-200/70 bg-white px-4 py-3 text-xs leading-6 text-ink-600">
                      {JSON.stringify(item.metadata)}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}

          {result.pagination.totalPages > 1 ? (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-700">
                {result.pagination.page} / {result.pagination.totalPages} 페이지
              </p>
              <div className="flex items-center gap-2">
                {result.pagination.page > 1 ? (
                  <Link
                    href={`/admin/notification-logs?page=${result.pagination.page - 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}`}
                    className="rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                  >
                    이전
                  </Link>
                ) : null}
                {result.pagination.page < result.pagination.totalPages ? (
                  <Link
                    href={`/admin/notification-logs?page=${result.pagination.page + 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}`}
                    className="rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    다음
                  </Link>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </AppFrame>
  );
}
