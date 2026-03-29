import { createSessionFromUserSelection, loginSessionSchema } from "@/features/auth";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = loginSessionSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "사용자와 부서를 다시 선택해 주세요.",
        parsed.error.flatten(),
        "LOGIN_SESSION_INVALID",
      );
    }

    const result = await createSessionFromUserSelection(parsed.data);
    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
