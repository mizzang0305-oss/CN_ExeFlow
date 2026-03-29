import Link from "next/link";

import {
  AppFrame,
  Badge,
  Button,
  Card,
  DirectiveCard,
  EmptyState,
} from "@/components";
import { requireCurrentSession } from "@/features/auth";
import {
  directiveStatusLabels,
  directiveListQuerySchema,
  directiveStatuses,
  listDirectivesForSession,
} from "@/features/directives";

export const dynamic = "force-dynamic";

type DirectivesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DirectivesPage({ searchParams }: DirectivesPageProps) {
  const session = await requireCurrentSession();
  const params = await searchParams;
  const parsed = directiveListQuerySchema.safeParse({
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    status: params.status,
  });
  const filters = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 20,
        search: undefined,
        status: undefined,
      };

  let result: Awaited<ReturnType<typeof listDirectivesForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    result = await listDirectivesForSession(session, filters);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "지시사항을 불러오지 못했습니다.";
  }

  const urgentCount = result?.items.filter((item) => item.isUrgent).length ?? 0;
  const delayedCount = result?.items.filter((item) => item.isDelayed).length ?? 0;

  return (
    <AppFrame
      currentPath="/directives"
      session={session}
      title="지시사항"
      description="긴급 건부터 보고, 바로 상세로 들어가 행동 로그를 남길 수 있도록 단순하게 구성했습니다."
    >
      {errorMessage || !result ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">목록을 불러오지 못했습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="default">{`총 ${result.pagination.total}건`}</Badge>
                  <Badge tone="danger">{`긴급 ${urgentCount}건`}</Badge>
                  <Badge tone="warning">{`지연 ${delayedCount}건`}</Badge>
                </div>
                <p className="text-sm text-ink-700">
                  {session.departmentName
                    ? `${session.departmentName} 기준 흐름에 맞춰 정렬했습니다.`
                    : "권한 범위에 맞는 지시사항만 표시합니다."}
                </p>
              </div>

              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <input
                  type="search"
                  name="search"
                  defaultValue={filters.search}
                  placeholder="관리번호나 제목으로 검색"
                  className="field"
                />
                <select
                  name="status"
                  defaultValue={filters.status ?? ""}
                  className="field appearance-none"
                >
                  <option value="">전체 상태</option>
                  {directiveStatuses.map((status) => (
                    <option key={status} value={status}>
                      {directiveStatusLabels[status]}
                    </option>
                  ))}
                </select>
                <div className="sm:col-span-2">
                  <Button type="submit" size="md">
                    적용
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          {result.items.length === 0 ? (
            <EmptyState
              title="표시할 지시사항이 없습니다"
              description="검색 조건을 줄이거나, 부서에 배정된 신규 지시사항이 등록되면 여기에 나타납니다."
            />
          ) : (
            <div className="grid gap-4">
              {result.items.map((directive) => (
                <DirectiveCard key={directive.id} directive={directive} />
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
                    href={`/directives?page=${result.pagination.page - 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}${filters.status ? `&status=${filters.status}` : ""}`}
                    className="rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                  >
                    이전
                  </Link>
                ) : null}
                {result.pagination.page < result.pagination.totalPages ? (
                  <Link
                    href={`/directives?page=${result.pagination.page + 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}${filters.status ? `&status=${filters.status}` : ""}`}
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
