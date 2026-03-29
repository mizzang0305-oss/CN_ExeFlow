import { requireAdminApiSession } from "@/features/auth";
import { listOrgTreeData, updateUser, userUpsertSchema } from "@/features/master";
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
    const session = await requireAdminApiSession();
    const body = await readJsonBody(request);
    const parsed = userUpsertSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "사용자 입력값을 다시 확인해 주세요.",
        parsed.error.flatten(),
        "ORG_USER_INVALID",
      );
    }

    const { userId } = await context.params;
    await updateUser(userId, parsed.data, session.userId);
    return createApiSuccessResponse(await listOrgTreeData());
  } catch (error) {
    return handleApiError(error);
  }
}
