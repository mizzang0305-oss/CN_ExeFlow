import { AppFrame, Card } from "@/components";
import { OrgAdminClient } from "@/components/org/org-admin-client";
import { requireAdminSession } from "@/features/auth";
import { listOrgTreeData } from "@/features/master";

export const dynamic = "force-dynamic";

export default async function DepartmentMasterPage() {
  const session = await requireAdminSession();
  let orgData: Awaited<ReturnType<typeof listOrgTreeData>> | null = null;
  let errorMessage: string | null = null;

  try {
    orgData = await listOrgTreeData();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.";
  }

  return (
    <AppFrame
      currentPath="/admin/master/departments"
      session={session}
      title="조직 운영도구"
      description={
        orgData
          ? "조직 구조, 사용자, 권한을 하나의 조직도 기반 운영 도구에서 실시간으로 관리합니다."
          : "조직 운영도구를 불러오지 못했습니다."
      }
    >
      {orgData ? (
        <OrgAdminClient initialData={orgData} />
      ) : (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">조직 운영도구를 열 수 없습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      )}
    </AppFrame>
  );
}
