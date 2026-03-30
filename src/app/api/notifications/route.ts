import { getCurrentSession } from "@/features/auth";
import { getNotificationSummary } from "@/features/notifications";
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

    const result = await getNotificationSummary(session);
    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
