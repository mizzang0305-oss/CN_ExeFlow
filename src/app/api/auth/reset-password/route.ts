import { authResetPasswordSchema, requestPasswordReset } from "@/features/auth";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = authResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "이메일을 다시 확인해주세요.",
        parsed.error.flatten(),
        "AUTH_RESET_PASSWORD_INVALID",
      );
    }

    const redirectTo = `${new URL(request.url).origin}/login?mode=recovery`;
    const result = await requestPasswordReset({
      email: parsed.data.email,
      redirectTo,
    });

    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
