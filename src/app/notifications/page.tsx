import Link from "next/link";

import { AppFrame, Badge, Card } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { listInboxNotifications, notificationInboxQuerySchema } from "@/features/notifications";

import { NotificationInboxClient } from "@/components/notifications/notification-inbox-client";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const session = await requireCurrentSession();
  const params = await searchParams;
  const parsed = notificationInboxQuerySchema.safeParse({
    page: readSingleValue(params.page),
    pageSize: readSingleValue(params.pageSize),
  });
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const result = await listInboxNotifications(session, filters);

  return (
    <AppFrame
      currentPath="/notifications"
      session={session}
      title="알림함"
      description="지시 배정, 완료 요청, 승인 필요, 반려 알림을 확인하고 관련 화면으로 바로 이동합니다."
    >
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge tone="default">{`전체 ${result.pagination.total}건`}</Badge>
                <Badge tone={result.unreadCount > 0 ? "danger" : "muted"}>
                  {result.unreadCount > 0 ? `읽지 않음 ${result.unreadCount}건` : "모두 확인됨"}
                </Badge>
              </div>
              <p className="text-sm text-ink-700">
                알림함을 열면 읽음 시간이 기록되고, 관련 화면으로 이동하면 클릭 이력이 저장됩니다.
              </p>
            </div>
          </div>
        </Card>

        <NotificationInboxClient initialItems={result.items} />

        {result.pagination.totalPages > 1 ? (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-700">
              {result.pagination.page} / {result.pagination.totalPages} 페이지
            </p>
            <div className="flex items-center gap-2">
              {result.pagination.page > 1 ? (
                <Link
                  href={`/notifications?page=${result.pagination.page - 1}&pageSize=${result.pagination.pageSize}`}
                  className="rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                >
                  이전
                </Link>
              ) : null}
              {result.pagination.page < result.pagination.totalPages ? (
                <Link
                  href={`/notifications?page=${result.pagination.page + 1}&pageSize=${result.pagination.pageSize}`}
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
