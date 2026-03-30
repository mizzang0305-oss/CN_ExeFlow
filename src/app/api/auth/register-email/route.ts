import { authRegisterCompanyEmailSchema, registerCompanyEmail } from "@/features/auth";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = authRegisterCompanyEmailSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "회사 이메일을 다시 확인해주세요.",
        parsed.error.flatten(),
        "AUTH_REGISTER_EMAIL_INVALID",
      );
    }

    const result = await registerCompanyEmail(parsed.data);
    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
