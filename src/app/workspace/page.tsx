import { AppFrame, ErrorState } from "@/components";
import { StaffWorkspaceClient } from "@/components/dashboard/staff-workspace-client";
import { trackUserActivityAsync } from "@/features/activity";
import { requireStaffSession } from "@/features/auth";
import { getStaffWorkspaceData } from "@/features/dashboard";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const session = await requireStaffSession("/workspace");

  let data: Awaited<ReturnType<typeof getStaffWorkspaceData>> | null = null;
  let errorMessage: string | null = null;

  try {
    data = await getStaffWorkspaceData(session);
    trackUserActivityAsync({
      activityType: "STAFF_HOME_VIEW",
      pagePath: "/workspace",
      session,
      targetType: "dashboard",
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "실무자 홈을 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/workspace"
      description="내 담당 지시, 마감 임박, 최근 로그, 증빙 보완 항목을 한 화면에서 바로 처리할 수 있게 구성했습니다."
      enforceRoleHome
      session={session}
      title="내 실행 공간"
    >
      {errorMessage || !data ? (
        <ErrorState title="실무자 홈을 불러오지 못했습니다." description={errorMessage ?? "잠시 후 다시 시도해주세요."} />
      ) : (
        <StaffWorkspaceClient data={data} />
      )}
    </AppFrame>
  );
}
