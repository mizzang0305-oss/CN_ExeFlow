import Link from "next/link";

import { AppFrame, Badge, Button, Card, EmptyState } from "@/components";
import { activityPaginationSchema, authActivityEventLabels, listAuthActivityLogsForSession } from "@/features/activity";
import { requireCurrentSession } from "@/features/auth";
import { formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

type AuthLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthLogsPage({ searchParams }: AuthLogsPageProps) {
  const session = await requireCurrentSession();
  const params = await searchParams;
  const parsed = activityPaginationSchema.safeParse({
    page: readSingleValue(params.page),
    pageSize: 30,
    search: readSingleValue(params.search),
  });
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 30, search: undefined };
  const result = await listAuthActivityLogsForSession(session, filters);

  return (
    <AppFrame
      currentPath="/admin/auth-logs"
      session={session}
      title="접속 로그"
      description="로그인 성공, 실패, 로그아웃, 세션 만료를 추적하는 인증 감사 화면입니다."
    >
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge tone="default">{`총 ${result.pagination.total}건`}</Badge>
                <Badge tone="muted">비동기 감사 로그</Badge>
              </div>
              <p className="text-sm text-ink-700">
                권한 범위에 따라 전체, 부서, 본인 로그만 표시됩니다.
              </p>
            </div>

            <form className="flex flex-wrap gap-2">
              <input
                type="search"
                name="search"
                defaultValue={filters.search}
                placeholder="이메일 검색"
                className="field min-w-[240px]"
              />
              <Button type="submit" size="md">
                적용
              </Button>
            </form>
          </div>
        </Card>

        {result.items.length === 0 ? (
          <EmptyState title="표시할 접속 로그가 없습니다" description="조건에 맞는 접속 기록이 아직 없습니다." />
        ) : (
          <div className="grid gap-4">
            {result.items.map((item) => (
              <Card key={item.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.eventResult === "FAILED" ? "danger" : item.eventResult === "EXPIRED" ? "warning" : "default"}>
                    {authActivityEventLabels[item.eventType]}
                  </Badge>
                  <Badge tone="muted">{item.email ?? "이메일 없음"}</Badge>
                  {item.departmentName ? <Badge tone="muted">{item.departmentName}</Badge> : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">사용자</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">{item.userName ?? "미확인"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">접속 시각</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">{formatDateTimeLabel(item.happenedAt)}</p>
                    <p className="mt-1 text-xs text-ink-600">{formatRelativeUpdate(item.happenedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">접속 환경</p>
                    <p className="mt-2 text-sm text-ink-700">{item.platform ?? "미확인"} · {item.deviceType ?? "기기 미확인"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">IP 주소</p>
                    <p className="mt-2 text-sm text-ink-700">{item.ipAddress ?? "미확인"}</p>
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
                  href={`/admin/auth-logs?page=${result.pagination.page - 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}`}
                  className="rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                >
                  이전
                </Link>
              ) : null}
              {result.pagination.page < result.pagination.totalPages ? (
                <Link
                  href={`/admin/auth-logs?page=${result.pagination.page + 1}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ""}`}
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
