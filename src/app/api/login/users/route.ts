import { getInitialSetupUsersByDepartment } from "@/features/auth";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const departmentId = new URL(request.url).searchParams.get("departmentId")?.trim();

    if (!departmentId) {
      throw new ApiError(400, "부서를 다시 선택해주세요.", null, "LOGIN_USERS_DEPARTMENT_REQUIRED");
    }

    const data = await getInitialSetupUsersByDepartment(departmentId);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
