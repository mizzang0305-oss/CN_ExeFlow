import { requireAdminApiSession } from "@/features/auth";
import { createUser, listOrgTreeData, userUpsertSchema } from "@/features/master";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

    await createUser(parsed.data, session.userId);
    return createApiSuccessResponse(await listOrgTreeData(), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
