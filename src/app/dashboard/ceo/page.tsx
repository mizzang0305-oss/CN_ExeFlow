import { AppFrame, ErrorState } from "@/components";
import { CeoDashboardClient } from "@/components/dashboard/ceo-dashboard-client";
import { trackUserActivityAsync } from "@/features/activity";
import { requireDashboardSession } from "@/features/auth";
import { getCeoDashboardData } from "@/features/dashboard";

export const dynamic = "force-dynamic";

export default async function CeoDashboardPage() {
  const session = await requireDashboardSession("/dashboard/ceo");

  let data: Awaited<ReturnType<typeof getCeoDashboardData>> | null = null;
  let errorMessage: string | null = null;

  try {
    data = await getCeoDashboardData(session);
    trackUserActivityAsync({
      activityType: "CEO_DASHBOARD_VIEW",
      pagePath: "/dashboard/ceo",
      session,
      targetType: "dashboard",
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "CEO 대시보드를 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/dashboard/ceo"
      description="승인 대기, 지연, 오늘 확인 항목을 먼저 보고, 상세 판단은 우측 패널과 하위 화면으로 이어지는 구조입니다."
      enforceRoleHome
      session={session}
      title="CEO 대시보드"
    >
      {errorMessage || !data ? (
        <ErrorState
          title="CEO 대시보드를 불러오지 못했습니다."
          description={errorMessage ?? "잠시 후 다시 시도해주세요."}
        />
      ) : (
        <CeoDashboardClient data={data} />
      )}
    </AppFrame>
  );
}
