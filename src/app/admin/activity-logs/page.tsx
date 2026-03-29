import Link from "next/link";

import { AppFrame, Badge, Button, Card, EmptyState } from "@/components";
import { activityPaginationSchema, listUserActivityLogsForSession, userActivityLabels } from "@/features/activity";
import { requireCurrentSession } from "@/features/auth";
import { formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

type ActivityLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ActivityLogsPage({ searchParams }: ActivityLogsPageProps) {
  const session = await requireCurrentSession();
  const params = await searchParams;
  const parsed = activityPaginationSchema.safeParse({
    page: readSingleValue(params.page),
    pageSize: 30,
    search: readSingleValue(params.search),
  });
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 30, search: undefined };
  const result = await listUserActivityLogsForSession(session, filters);

  return (
    <AppFrame
      currentPath="/admin/activity-logs"
      session={session}
      title="활동 로그"
      description="대시보드 진입, 지시 조회, 완료 요청, 승인, 반려, 로그 등록 같은 의미 있는 행동만 기록합니다."
    >
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge tone="default">{`총 ${result.pagination.total}건`}</Badge>
                <Badge tone="muted">의미 있는 행동만 기록</Badge>
              </div>
              <p className="text-sm text-ink-700">
                대시보드, 지시, 승인, 증빙 중심 행동만 남기고 과도한 로그는 줄였습니다.
              </p>
            </div>

            <form className="flex flex-wrap gap-2">
              <input
                type="search"
                name="search"
                defaultValue={filters.search}
                placeholder="행동 유형 또는 경로 검색"
                className="field min-w-[240px]"
              />
              <Button type="submit" size="md">
                적용
              </Button>
            </form>
          </div>
        </Card>

        {result.items.length === 0 ? (
          <EmptyState title="표시할 활동 로그가 없습니다" description="조건에 맞는 활동 기록이 아직 없습니다." />
        ) : (
          <div className="grid gap-4">
            {result.items.map((item) => (
              <Card key={item.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="default">{userActivityLabels[item.activityType]}</Badge>
                  {item.departmentName ? <Badge tone="muted">{item.departmentName}</Badge> : null}
                  {item.pagePath ? <Badge tone="muted">{item.pagePath}</Badge> : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">사용자</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">{item.userName ?? item.userId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">행동 시각</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">{formatDateTimeLabel(item.happenedAt)}</p>
                    <p className="mt-1 text-xs text-ink-600">{formatRelativeUpdate(item.happenedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">대상</p>
                    <p className="mt-2 text-sm text-ink-700">
                      {item.targetType ?? "공통"}
                      {item.targetId ? ` · ${item.targetId}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">추가 정보</p>
                    <p className="mt-2 text-sm text-ink-700">
                      {Object.keys(item.metadata).length > 0 ? JSON.stringify(item.metadata) : "추가 정보 없음"}
                    </p>
                  </div>
                </div>
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
                  href={`/admin/activity-logs?page=${result.pagination.page - 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}`}
                  className="rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                >
                  이전
                </Link>
              ) : null}
              {result.pagination.page < result.pagination.totalPages ? (
                <Link
                  href={`/admin/activity-logs?page=${result.pagination.page + 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}`}
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
