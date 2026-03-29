import { AppFrame, Card } from "@/components";
import { UserMasterClient } from "@/components/master/user-master-client";
import { requireAdminSession } from "@/features/auth";
import { listMasterLookupData } from "@/features/master";

export const dynamic = "force-dynamic";

export default async function UserMasterPage() {
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
      currentPath="/admin/master/users"
      session={session}
      title="사용자 기준정보"
      description={lookup ? "부서 배정, 표시명, 역할, 활성 상태를 운영 기준에 맞게 관리합니다." : "사용자 기준정보를 불러오지 못했습니다."}
    >
      {lookup ? (
        <UserMasterClient departments={lookup.departments} users={lookup.users} />
      ) : (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">사용자 기준정보를 열 수 없습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      )}
    </AppFrame>
  );
}
