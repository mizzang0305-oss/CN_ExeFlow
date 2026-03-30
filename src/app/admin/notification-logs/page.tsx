import Link from "next/link";
import { redirect } from "next/navigation";

import { AppFrame, Badge, Button, Card, EmptyState } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { canViewNotificationLogPage, getDefaultAppRoute } from "@/features/auth/utils";
import {
  listNotificationLogsForSession,
  listNotificationUserOptionsForSession,
  notificationChannelLabels,
  notificationChannels,
  notificationDeliveryStatusLabels,
  notificationDeliveryStatuses,
  notificationLogsQuerySchema,
  notificationTypeLabels,
  notificationTypes,
} from "@/features/notifications";
import { formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

type NotificationLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveStatusTone(status: (typeof notificationDeliveryStatuses)[number]) {
  if (status === "FAILED") {
    return "danger" as const;
  }

  if (status === "READ") {
    return "success" as const;
  }

  if (status === "OPENED") {
    return "default" as const;
  }

  return status === "PENDING" ? ("warning" as const) : ("muted" as const);
}

export default async function NotificationLogsPage({ searchParams }: NotificationLogsPageProps) {
  const session = await requireCurrentSession();

  if (!canViewNotificationLogPage(session.role)) {
    redirect(getDefaultAppRoute(session.role));
  }

  const params = await searchParams;
  const parsed = notificationLogsQuerySchema.safeParse({
    channel: readSingleValue(params.channel),
    deliveryStatus: readSingleValue(params.deliveryStatus),
    fromDate: readSingleValue(params.fromDate),
    notificationType: readSingleValue(params.notificationType),
    page: readSingleValue(params.page),
    pageSize: 30,
    search: readSingleValue(params.search),
    toDate: readSingleValue(params.toDate),
    userId: readSingleValue(params.userId),
  });
  const filters = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 30,
      };

  const [result, userOptions] = await Promise.all([
    listNotificationLogsForSession(session, filters),
    listNotificationUserOptionsForSession(session),
  ]);

  const keepParams = new URLSearchParams();
  if (filters.search) keepParams.set("search", filters.search);
  if (filters.userId) keepParams.set("userId", filters.userId);
  if (filters.notificationType) keepParams.set("notificationType", filters.notificationType);
  if (filters.channel) keepParams.set("channel", filters.channel);
  if (filters.deliveryStatus) keepParams.set("deliveryStatus", filters.deliveryStatus);
  if (filters.fromDate) keepParams.set("fromDate", filters.fromDate);
  if (filters.toDate) keepParams.set("toDate", filters.toDate);

  return (
    <AppFrame
      currentPath="/admin/notification-logs"
      session={session}
      title="알림 로그"
      description="지시 배정, 완료 요청, 승인 필요, 반려, 승인 완료 알림의 운영 이력을 검증합니다."
    >
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge tone="default">{`전체 ${result.pagination.total}건`}</Badge>
                <Badge tone="muted">감사 및 운영 데이터</Badge>
              </div>
              <p className="text-sm text-ink-700">
                삭제 없이 누가 어떤 알림을 받고, 읽고, 클릭했는지 추적합니다.
              </p>
            </div>

            <form className="grid gap-3 lg:grid-cols-6">
              <input
                type="search"
                name="search"
                defaultValue={filters.search}
                placeholder="제목 또는 본문 검색"
                className="field lg:col-span-2"
              />

              <select name="userId" defaultValue={filters.userId ?? ""} className="field">
                <option value="">전체 사용자</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>

              <select name="notificationType" defaultValue={filters.notificationType ?? ""} className="field">
                <option value="">전체 유형</option>
                {notificationTypes.map((notificationType) => (
                  <option key={notificationType} value={notificationType}>
                    {notificationTypeLabels[notificationType]}
                  </option>
                ))}
              </select>

              <select name="channel" defaultValue={filters.channel ?? ""} className="field">
                <option value="">전체 채널</option>
                {notificationChannels.map((channel) => (
                  <option key={channel} value={channel}>
                    {notificationChannelLabels[channel]}
                  </option>
                ))}
              </select>

              <select name="deliveryStatus" defaultValue={filters.deliveryStatus ?? ""} className="field">
                <option value="">전체 상태</option>
                {notificationDeliveryStatuses.map((deliveryStatus) => (
                  <option key={deliveryStatus} value={deliveryStatus}>
                    {notificationDeliveryStatusLabels[deliveryStatus]}
                  </option>
                ))}
              </select>

              <input type="date" name="fromDate" defaultValue={filters.fromDate ?? ""} className="field" />
              <input type="date" name="toDate" defaultValue={filters.toDate ?? ""} className="field" />

              <div className="flex gap-2 lg:col-span-2">
                <Button type="submit" size="md">
                  필터 적용
                </Button>
                <Link
                  href="/admin/notification-logs"
                  className="inline-flex h-11 items-center justify-center rounded-[20px] border border-brand-100/80 bg-brand-50/85 px-4 text-sm font-semibold text-brand-900 shadow-[0_12px_28px_rgba(7,32,63,0.08)]"
                >
                  초기화
                </Link>
              </div>
            </form>
          </div>
        </Card>

        {result.items.length === 0 ? (
          <EmptyState
            title="표시할 알림 로그가 없습니다"
            description="현재 권한 범위와 필터 조건에 맞는 알림 로그가 없습니다."
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
                  {item.userName ? <Badge tone="muted">{item.userName}</Badge> : null}
                  {item.directiveNo ? <Badge tone="muted">{item.directiveNo}</Badge> : null}
                </div>

                <div className="space-y-2">
                  <p className="text-base font-semibold text-ink-950">{item.title}</p>
                  <p className="text-sm leading-6 text-ink-700">{item.body}</p>
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">생성 시간</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">{formatDateTimeLabel(item.createdAt)}</p>
                    <p className="mt-1 text-xs text-ink-600">{formatRelativeUpdate(item.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">읽음 여부</p>
                    <p className="mt-2 text-sm text-ink-700">{item.readAt ? "읽음" : "미읽음"}</p>
                    <p className="mt-1 text-xs text-ink-600">
                      {item.readAt ? formatDateTimeLabel(item.readAt) : "기록 없음"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">클릭 여부</p>
                    <p className="mt-2 text-sm text-ink-700">{item.clickedAt ? "클릭됨" : "미클릭"}</p>
                    <p className="mt-1 text-xs text-ink-600">
                      {item.clickedAt ? formatDateTimeLabel(item.clickedAt) : "기록 없음"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">관련 지시사항</p>
                    {item.directiveId ? (
                      <Link href={`/directives/${item.directiveId}`} className="mt-2 inline-flex text-sm font-semibold text-brand-700">
                        {item.directiveTitle ?? item.directiveNo ?? item.directiveId}
                      </Link>
                    ) : (
                      <p className="mt-2 text-sm text-ink-700">연결 없음</p>
                    )}
                  </div>
                </div>

                {Object.keys(item.payload).length > 0 ? (
                  <div className="rounded-2xl border border-ink-200/70 bg-white px-4 py-3 text-xs leading-6 text-ink-600">
                    {JSON.stringify(item.payload)}
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
                  href={`/admin/notification-logs?page=${result.pagination.page - 1}${keepParams.toString() ? `&${keepParams.toString()}` : ""}`}
                  className="rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                >
                  이전
                </Link>
              ) : null}
              {result.pagination.page < result.pagination.totalPages ? (
                <Link
                  href={`/admin/notification-logs?page=${result.pagination.page + 1}${keepParams.toString() ? `&${keepParams.toString()}` : ""}`}
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
