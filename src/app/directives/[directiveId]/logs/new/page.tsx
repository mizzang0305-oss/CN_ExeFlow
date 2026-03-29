import { AppFrame, Card, LogForm } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { getDirectiveDetailForSession } from "@/features/directives";

export const dynamic = "force-dynamic";

type NewDirectiveLogPageProps = {
  params: Promise<{
    directiveId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewDirectiveLogPage({ params, searchParams }: NewDirectiveLogPageProps) {
  const session = await requireCurrentSession();
  const { directiveId } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedDepartmentId =
    typeof resolvedSearchParams.departmentId === "string" ? resolvedSearchParams.departmentId : null;

  let directive: Awaited<ReturnType<typeof getDirectiveDetailForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    directive = await getDirectiveDetailForSession(session, directiveId);

    if (!directive.workflow.canManageLogs) {
      throw new Error("이 지시에 행동 로그를 등록할 권한이 없습니다.");
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "행동 로그 화면을 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/directives"
      session={session}
      title="행동 로그 등록"
      description={directive ? `${directive.directiveNo} · ${directive.title}` : undefined}
    >
      {errorMessage || !directive ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">로그 등록 화면을 열 수 없습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <LogForm
          defaultDepartmentId={
            requestedDepartmentId && directive.departments.some((department) => department.departmentId === requestedDepartmentId)
              ? requestedDepartmentId
              : directive.workflow.currentDepartmentId
          }
          departments={directive.departments}
          directiveId={directive.id}
          mode="create"
        />
      )}
    </AppFrame>
  );
}
