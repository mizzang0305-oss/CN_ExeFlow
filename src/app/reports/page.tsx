import { AppFrame, Card, CardDescription, CardTitle } from "@/components";
import { requireCurrentSession } from "@/features/auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await requireCurrentSession();

  return (
    <AppFrame
      currentPath="/reports"
      session={session}
      title="리포트"
      description="현재 핵심 흐름은 지시사항 실행과 대시보드 판단에 집중하고 있습니다."
    >
      <Card className="space-y-3">
        <CardTitle>리포트 화면은 다음 단계입니다</CardTitle>
        <CardDescription>
          이번 작업에서는 로그인, 지시사항 리스트, 상세, 행동 로그, 대표 대시보드의 핵심 흐름을
          우선 완성했습니다.
        </CardDescription>
      </Card>
    </AppFrame>
  );
}
