import { AppFrame, Card, LogForm } from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { getDirectiveDetailForSession } from "@/features/directives";

export const dynamic = "force-dynamic";

type NewDirectiveLogPageProps = {
  params: Promise<{
    directiveId: string;
  }>;
};

export default async function NewDirectiveLogPage({
  params,
}: NewDirectiveLogPageProps) {
  const session = await requireCurrentSession();
  const { directiveId } = await params;

  let directive: Awaited<ReturnType<typeof getDirectiveDetailForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    directive = await getDirectiveDetailForSession(session, directiveId);

    if (!directive.canManageLogs) {
      throw new Error("이 지시사항에 행동 로그를 등록할 권한이 없습니다.");
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "행동 로그 화면을 열 수 없습니다.";
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
        <LogForm directiveId={directive.id} mode="create" session={session} />
      )}
    </AppFrame>
  );
}
