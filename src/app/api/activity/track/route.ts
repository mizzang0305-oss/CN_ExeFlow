import type { JsonObject } from "@/types";
import { requireCurrentSession } from "@/features/auth";
import { trackUserActivityAsync, trackUserActivitySchema } from "@/features/activity";
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
        parsed.error.issues[0]?.message ?? "활동 로그 요청이 올바르지 않습니다.",
        parsed.error.flatten(),
        "USER_ACTIVITY_INVALID",
      );
    }

    trackUserActivityAsync({
      activityType: parsed.data.activityType,
      departmentId: session.departmentId,
      metadata: parsed.data.metadata as JsonObject | undefined,
      pagePath: parsed.data.pagePath ?? null,
      targetId: parsed.data.targetId ?? null,
      targetType: parsed.data.targetType ?? null,
      userId: session.userId,
    });

    return createApiSuccessResponse({ tracked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
