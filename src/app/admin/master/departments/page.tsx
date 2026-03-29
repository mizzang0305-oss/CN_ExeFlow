import { AppFrame, Card } from "@/components";
import { DepartmentMasterClient } from "@/components/master/department-master-client";
import { requireAdminSession } from "@/features/auth";
import { listMasterLookupData } from "@/features/master";

export const dynamic = "force-dynamic";

export default async function DepartmentMasterPage() {
  const session = await requireAdminSession();
  let lookup: Awaited<ReturnType<typeof listMasterLookupData>> | null = null;
  let errorMessage: string | null = null;

  try {
    lookup = await listMasterLookupData();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.";
  }

  return (
    <AppFrame
      currentPath="/admin/master/departments"
      session={session}
      title="부서 기준정보"
      description={lookup ? "로그인 권한과 실행 범위의 기준이 되는 조직 마스터를 관리합니다." : "부서 기준정보를 불러오지 못했습니다."}
    >
      {lookup ? (
        <DepartmentMasterClient departments={lookup.departments} users={lookup.users} />
      ) : (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">부서 기준정보를 열 수 없습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      )}
    </AppFrame>
  );
}
