import { AppFrame, Card, LogForm } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { getDirectiveDetailForSession } from "@/features/directives";

export const dynamic = "force-dynamic";

type EditDirectiveLogPageProps = {
  params: Promise<{
    directiveId: string;
    logId: string;
  }>;
};

export default async function EditDirectiveLogPage({ params }: EditDirectiveLogPageProps) {
  const session = await requireCurrentSession();
  const { directiveId, logId } = await params;

  let directive: Awaited<ReturnType<typeof getDirectiveDetailForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    directive = await getDirectiveDetailForSession(session, directiveId);

    if (!directive.workflow.canManageLogs) {
      throw new Error("이 지시사항의 행동 로그를 수정할 권한이 없습니다.");
    }

    const targetLog = directive.logs.find((log) => log.id === logId);

    if (!targetLog) {
      throw new Error("수정할 행동 로그를 찾을 수 없습니다.");
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "행동 로그 수정 화면을 불러오지 못했습니다.";
  }

  const targetLog = directive?.logs.find((log) => log.id === logId) ?? null;

  return (
    <AppFrame
      currentPath="/directives"
      session={session}
      title="행동 로그 수정"
      description={directive ? `${directive.directiveNo} · ${directive.title}` : undefined}
    >
      {errorMessage || !directive || !targetLog ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">로그 수정 화면을 열 수 없습니다</h2>
          <p className="text-sm text-danger-700">
            {errorMessage ?? "수정할 행동 로그를 찾을 수 없습니다."}
          </p>
        </Card>
      ) : (
        <LogForm directiveId={directive.id} initialLog={targetLog} mode="edit" />
      )}
    </AppFrame>
  );
}
