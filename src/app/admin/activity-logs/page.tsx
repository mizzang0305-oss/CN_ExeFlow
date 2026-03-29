import Link from "next/link";

import { AppFrame, Badge, Button, Card, EmptyState } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { roleLabelMap } from "@/features/auth/utils";
import {
  activityTargetTypeLabels,
  activityPaginationQuerySchema,
  listUserActivityLogsForSession,
  userActivityTypeLabels,
} from "@/features/activity";
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
  const parsed = activityPaginationQuerySchema.safeParse({
    page: readSingleValue(params.page),
    pageSize: readSingleValue(params.pageSize),
    search: readSingleValue(params.search),
  });
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 30, search: undefined };

  let result: Awaited<ReturnType<typeof listUserActivityLogsForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    result = await listUserActivityLogsForSession(session, filters);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "활동 로그를 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/admin/activity-logs"
      session={session}
      title="활동 로그"
      description="대시보드 진입, 지시 조회, 완료 요청, 승인, 반려, 로그 등록과 첨부 업로드 등 의미 있는 행동만 기록합니다."
    >
      {errorMessage || !result ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">활동 로그를 불러오지 못했습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="default">{`총 ${result.pagination.total}건`}</Badge>
                  <Badge tone="muted">의미 있는 행동만 기록</Badge>
                </div>
                <p className="text-sm text-ink-700">
                  화면 조회와 핵심 클릭 이벤트를 역할 범위에 맞춰 확인할 수 있습니다.
                </p>
              </div>

              <form className="flex flex-col gap-3 sm:flex-row">
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
            <EmptyState
              title="활동 로그가 없습니다"
              description="현재 권한 범위에서 조회되는 활동 로그가 없습니다."
            />
          ) : (
            <div className="grid gap-4">
              {result.items.map((item) => (
                <Card key={item.id} className="space-y-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="default">{userActivityTypeLabels[item.activityType]}</Badge>
                        {item.targetType ? (
                          <Badge tone="muted">
                            {activityTargetTypeLabels[item.targetType] ?? item.targetType}
                          </Badge>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-ink-950">
                          {item.user?.displayName ?? "미확인 사용자"}
                        </p>
                        <p className="mt-2 text-sm text-ink-700">
                          {item.pagePath ?? "경로 미기록"}
                          {item.targetId ? ` · 대상 ${item.targetId}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">시각</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">{formatDateTimeLabel(item.happenedAt)}</p>
                        <p className="mt-1 text-xs text-ink-600">{formatRelativeUpdate(item.happenedAt)}</p>
                      </div>
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">부서</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">{item.user?.departmentName ?? "미배정"}</p>
                      </div>
                      <div className="rounded-2xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">역할</p>
                        <p className="mt-2 text-sm font-semibold text-ink-950">
                          {item.user?.role ? roleLabelMap[item.user.role] : "미기록"}
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
      )}
    </AppFrame>
  );
}
