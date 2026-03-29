import { requireAdminSession } from "@/features/auth";
import { updateUser, userUpsertSchema } from "@/features/master";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

type UserRouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: UserRouteContext) {
  try {
    const session = await requireAdminSession();
    const body = await readJsonBody(request);
    const parsed = userUpsertSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "사용자 입력값을 다시 확인해 주세요.",
        parsed.error.flatten(),
        "MASTER_USER_INVALID",
      );
    }

    const { userId } = await context.params;
    const data = await updateUser(userId, parsed.data, session.userId);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
