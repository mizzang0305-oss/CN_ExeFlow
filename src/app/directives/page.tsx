import Link from "next/link";

import { AppFrame, Badge, Button, Card, DirectiveCard, EmptyState } from "@/components";
import {
  canAccessApprovalQueue,
  isAdminRole,
  isExecutiveRole,
  requireCurrentSession,
} from "@/features/auth";
import {
  directiveListQuerySchema,
  directiveStatusLabels,
  directiveStatuses,
  listDirectivesForSession,
} from "@/features/directives";

export const dynamic = "force-dynamic";

type DirectivesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DirectivesPage({ searchParams }: DirectivesPageProps) {
  const session = await requireCurrentSession();
  const params = await searchParams;
  const parsed = directiveListQuerySchema.safeParse({
    page: readSingleValue(params.page),
    pageSize: readSingleValue(params.pageSize),
    search: readSingleValue(params.search),
    status: readSingleValue(params.status),
    urgent: readSingleValue(params.urgent),
  });
  const filters = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 20,
        search: undefined,
        status: undefined,
        urgent: undefined,
      };

  let result: Awaited<ReturnType<typeof listDirectivesForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    result = await listDirectivesForSession(session, filters);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "지시 목록을 불러오지 못했습니다.";
  }

  const urgentCount = result?.items.filter((item) => item.isUrgent).length ?? 0;
  const delayedCount = result?.items.filter((item) => item.isDelayed).length ?? 0;
  const canCreateDirective = isAdminRole(session.role) || isExecutiveRole(session.role);
  const canOpenApprovalQueue = canAccessApprovalQueue(session.role);

  return (
    <AppFrame
      currentPath="/directives"
      session={session}
      title="지시 관리"
      description="긴급 항목과 지연 신호를 먼저 보고, 상세 화면에서 로그 등록과 승인 흐름까지 이어갈 수 있도록 구성했습니다."
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
                  <Badge tone="default">{`전체 ${result.pagination.total}건`}</Badge>
                  <Badge tone="danger">{`긴급 ${urgentCount}건`}</Badge>
                  <Badge tone="warning">{`지연 ${delayedCount}건`}</Badge>
                  {filters.status ? <Badge tone="muted">{directiveStatusLabels[filters.status]}</Badge> : null}
                  {filters.urgent ? <Badge tone="danger">긴급만 보기</Badge> : null}
                </div>
                <p className="text-sm text-ink-700">
                  {session.departmentName
                    ? `${session.departmentName} 기준으로 접근 가능한 지시만 보여줍니다.`
                    : "현재 권한 범위에 맞는 지시만 보여줍니다."}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_160px]">
                  <input
                    type="search"
                    name="search"
                    defaultValue={filters.search}
                    placeholder="관리번호, 제목, 내용 검색"
                    className="field"
                  />
                  <select name="status" defaultValue={filters.status ?? ""} className="field appearance-none">
                    <option value="">전체 상태</option>
                    {directiveStatuses.map((status) => (
                      <option key={status} value={status}>
                        {directiveStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                  <select
                    name="urgent"
                    defaultValue={filters.urgent === undefined ? "" : filters.urgent ? "true" : "false"}
                    className="field appearance-none"
                  >
                    <option value="">전체 우선순위</option>
                    <option value="true">긴급만</option>
                    <option value="false">일반 포함</option>
                  </select>
                  <div className="sm:col-span-3 flex flex-wrap gap-2">
                    <Button type="submit" size="md">
                      적용
                    </Button>
                    <Link href="/directives" className="inline-flex items-center text-sm font-semibold text-ink-500">
                      필터 초기화
                    </Link>
                  </div>
                </form>

                {canOpenApprovalQueue ? (
                  <Link href="/directives/approval-queue">
                    <Button size="md" variant="secondary">
                      승인 대기 큐
                    </Button>
                  </Link>
                ) : null}

                {canCreateDirective ? (
                  <Link href="/directives/new">
                    <Button size="md">지시 등록</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </Card>

          {result.items.length === 0 ? (
            <EmptyState
              title="표시할 지시가 없습니다"
              description="검색 조건이 좁거나, 아직 지시가 등록되지 않았습니다."
              action={
                canCreateDirective ? (
                  <Link href="/directives/new">
                    <Button size="md">첫 지시 등록</Button>
                  </Link>
                ) : null
              }
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
                    href={`/directives?page=${result.pagination.page - 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}${filters.status ? `&status=${filters.status}` : ""}${filters.urgent !== undefined ? `&urgent=${filters.urgent}` : ""}`}
                    className="rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                  >
                    이전
                  </Link>
                ) : null}
                {result.pagination.page < result.pagination.totalPages ? (
                  <Link
                    href={`/directives?page=${result.pagination.page + 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}${filters.status ? `&status=${filters.status}` : ""}${filters.urgent !== undefined ? `&urgent=${filters.urgent}` : ""}`}
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
