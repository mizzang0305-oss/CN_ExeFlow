import { auditUnauthorizedDashboardApiAccess, getCurrentSession } from "@/features/auth";
import { getStaffWorkspaceData } from "@/features/dashboard";
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

    if (session.role !== "STAFF") {
      auditUnauthorizedDashboardApiAccess(session, "/api/dashboard/staff/me", ["STAFF"]);
      return createApiErrorResponse(403, {
        code: "STAFF_WORKSPACE_ACCESS_DENIED",
        message: "실무자 홈 데이터는 STAFF 계정만 조회할 수 있습니다.",
      });
    }

    const data = await getStaffWorkspaceData(session);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
