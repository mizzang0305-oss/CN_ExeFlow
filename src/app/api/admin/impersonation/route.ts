import {
  getCurrentSession,
  listImpersonationUsersAsSession,
} from "@/features/auth";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
  handleApiError,
} from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session?.userId) {
      return createApiErrorResponse(401, {
        code: "INVALID_SESSION",
        message: "세션이 유효하지 않습니다.",
      });
    }

    const users = await listImpersonationUsersAsSession(session);
    return createApiSuccessResponse({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
