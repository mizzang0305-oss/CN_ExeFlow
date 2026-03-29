import Link from "next/link";

import { AppFrame, Badge, Button, Card, EmptyState } from "@/components";
import {
  activityPaginationSchema,
  listNotificationLogsForSession,
  notificationChannelLabels,
  notificationDeliveryStatusLabels,
  notificationTypeLabels,
} from "@/features/activity";
import { requireCurrentSession } from "@/features/auth";
import { formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

type NotificationLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveStatusTone(status: "PENDING" | "SENT" | "FAILED") {
  if (status === "FAILED") {
    return "danger" as const;
  }

  if (status === "SENT") {
    return "success" as const;
  }

  return "warning" as const;
}

export default async function NotificationLogsPage({ searchParams }: NotificationLogsPageProps) {
  const session = await requireCurrentSession();
  const params = await searchParams;
  const parsed = activityPaginationSchema.safeParse({
    page: readSingleValue(params.page),
    pageSize: 30,
    search: readSingleValue(params.search),
  });
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 30, search: undefined };
  const result = await listNotificationLogsForSession(session, filters);

  return (
    <AppFrame
      currentPath="/admin/notification-logs"
      session={session}
      title="알림 로그"
      description="지시 배정, 완료 요청, 승인 요청, 승인 완료, 반려, 지연 발생 알림의 발송 이력을 확인합니다."
    >
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge tone="default">{`총 ${result.pagination.total}건`}</Badge>
                <Badge tone="muted">푸시 발송 이력</Badge>
              </div>
              <p className="text-sm text-ink-700">
                의미 있는 알림만 기록해 경영 판단과 실행 통제 흐름을 추적합니다.
              </p>
            </div>

            <form className="flex flex-wrap gap-2">
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
            title="표시할 알림 로그가 없습니다"
            description="현재 권한 범위에서 조회되는 알림 로그가 없습니다."
          />
        ) : (
          <div className="grid gap-4">
            {result.items.map((item) => (
              <Card key={item.id} className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="default">{notificationTypeLabels[item.notificationType]}</Badge>
                  <Badge tone="muted">{notificationChannelLabels[item.channel]}</Badge>
                  <Badge tone={resolveStatusTone(item.deliveryStatus)}>
                    {notificationDeliveryStatusLabels[item.deliveryStatus]}
                  </Badge>
                  {item.directiveId ? <Badge tone="muted">{`지시 ${item.directiveId}`}</Badge> : null}
                </div>

                <div className="space-y-2">
                  <p className="text-base font-semibold text-ink-950">{item.title}</p>
                  <p className="text-sm leading-6 text-ink-700">{item.body}</p>
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">수신자</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">{item.userName ?? item.userId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">발송 시각</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">{formatDateTimeLabel(item.sentAt)}</p>
                    <p className="mt-1 text-xs text-ink-600">{formatRelativeUpdate(item.sentAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">열람 시각</p>
                    <p className="mt-2 text-sm text-ink-700">
                      {item.readAt ? formatDateTimeLabel(item.readAt) : "미열람"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">클릭 시각</p>
                    <p className="mt-2 text-sm text-ink-700">
                      {item.clickedAt ? formatDateTimeLabel(item.clickedAt) : "미클릭"}
                    </p>
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
    </AppFrame>
  );
}
