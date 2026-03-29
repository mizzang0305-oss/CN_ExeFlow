import { AppFrame, Card, DirectiveForm } from "@/components";
import { requireAdminSession } from "@/features/auth";
import { listMasterLookupData } from "@/features/master";

export const dynamic = "force-dynamic";

export default async function NewDirectivePage() {
  const session = await requireAdminSession();

  let lookup: Awaited<ReturnType<typeof listMasterLookupData>> | null = null;
  let errorMessage: string | null = null;

  try {
    lookup = await listMasterLookupData();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "지시사항 등록 화면을 준비하지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/directives"
      session={session}
      title="지시사항 등록"
      description="대표 지시를 전사 실행 플로우에 올리는 시작 화면입니다."
    >
      {errorMessage || !lookup ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">등록 화면을 불러오지 못했습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <DirectiveForm
          departments={lookup.departments.filter((department) => department.isActive)}
          users={lookup.users}
        />
      )}
    </AppFrame>
  );
}
