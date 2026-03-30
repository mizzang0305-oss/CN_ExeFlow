import { auditUnauthorizedDashboardApiAccess, getCurrentSession } from "@/features/auth";
import { getDepartmentDashboardData } from "@/features/dashboard";
import { isAdminRole } from "@/features/auth/utils";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type DepartmentDashboardRouteContext = {
  params: Promise<{
    departmentId: string;
  }>;
};

export async function GET(_: Request, context: DepartmentDashboardRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { departmentId } = await context.params;
    const isAllowedDepartmentHead = session.role === "DEPARTMENT_HEAD" && session.departmentId === departmentId;

    if (!isAdminRole(session.role) && !isAllowedDepartmentHead) {
      auditUnauthorizedDashboardApiAccess(session, `/api/dashboard/department/${departmentId}`, [
        "CEO",
        "SUPER_ADMIN",
        "DEPARTMENT_HEAD",
      ]);
      return createApiErrorResponse(403, {
        code: "DEPARTMENT_DASHBOARD_ACCESS_DENIED",
        message: "해당 부서 실행 보드는 권한이 있는 사용자만 조회할 수 있습니다.",
      });
    }

    const data = await getDepartmentDashboardData(session, departmentId);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
