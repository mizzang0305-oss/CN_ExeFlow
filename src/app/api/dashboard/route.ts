import { getCurrentSession, getDefaultAppRoute } from "@/features/auth";
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

    return createApiSuccessResponse({
      redirectTo: getDefaultAppRoute(session.role),
      role: session.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
