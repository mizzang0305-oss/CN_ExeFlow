import { getCurrentSession } from "@/features/auth";
import { markNotificationClicked, notificationClickSchema } from "@/features/notifications";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { notificationId } = await context.params;
    const body = await readJsonBody(request, { required: false });
    const parsed = notificationClickSchema.safeParse({
      targetPath: typeof body.targetPath === "string" ? body.targetPath : undefined,
    });

    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "알림 이동 경로가 올바르지 않습니다.", null, "NOTIFICATION_CLICK_INVALID");
    }

    await markNotificationClicked(session, notificationId, parsed.data.targetPath);
    return createApiSuccessResponse({
      clicked: true,
      message: "알림 클릭이 기록되었습니다.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
