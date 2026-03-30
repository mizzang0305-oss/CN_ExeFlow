import { auditUnauthorizedDashboardApiAccess, getCurrentSession } from "@/features/auth";
import { getCeoDashboardData } from "@/features/dashboard";
import { isAdminRole } from "@/features/auth/utils";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    if (!isAdminRole(session.role)) {
      auditUnauthorizedDashboardApiAccess(session, "/api/dashboard/ceo", ["CEO", "SUPER_ADMIN"]);
      return createApiErrorResponse(403, {
        code: "CEO_DASHBOARD_ACCESS_DENIED",
        message: "CEO 대시보드는 대표와 슈퍼 관리자만 조회할 수 있습니다.",
      });
    }

    const data = await getCeoDashboardData(session);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
