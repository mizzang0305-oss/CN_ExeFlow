import { requireAdminApiSession } from "@/features/auth";
import { listOrgTreeData, moveUser, userMoveSchema } from "@/features/master";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminApiSession();
    const body = await readJsonBody(request);
    const parsed = userMoveSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "이동할 사용자 정보를 다시 확인해 주세요.",
        parsed.error.flatten(),
        "ORG_USER_MOVE_INVALID",
      );
    }

    await moveUser(parsed.data, session.userId);
    return createApiSuccessResponse(await listOrgTreeData());
  } catch (error) {
    return handleApiError(error);
  }
}
