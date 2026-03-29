import { loginUsersQuerySchema, listUsersForDepartment } from "@/features/auth";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const parsed = loginUsersQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "부서를 다시 선택해 주세요.",
        parsed.error.flatten(),
        "LOGIN_USERS_QUERY_INVALID",
      );
    }

    const data = await listUsersForDepartment(parsed.data.departmentId);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
