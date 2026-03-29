import { activateUserWithEmail, authActivateSchema } from "@/features/auth";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = authActivateSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "최초 사용자 정보를 다시 확인해주세요.",
        parsed.error.flatten(),
        "AUTH_ACTIVATE_INVALID",
      );
    }

    const result = await activateUserWithEmail(parsed.data);
    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
