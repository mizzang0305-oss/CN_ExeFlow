import { requireCurrentSession } from "@/features/auth";
import { trackUserActivity, trackUserActivitySchema } from "@/features/activity";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
    const body = await readJsonBody(request);
    const parsed = trackUserActivitySchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "활동 로그 요청을 다시 확인해주세요.",
        parsed.error.flatten(),
        "USER_ACTIVITY_TRACK_INVALID",
      );
    }

    await trackUserActivity({
      ...parsed.data,
      session,
    });

    return createApiSuccessResponse({ tracked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
