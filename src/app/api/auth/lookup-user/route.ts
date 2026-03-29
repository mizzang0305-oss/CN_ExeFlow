import { authLookupSchema, lookupUserByEmailForActivation } from "@/features/auth";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const email = new URL(request.url).searchParams.get("email") ?? "";
    const parsed = authLookupSchema.safeParse({ email });

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "이메일을 다시 확인해주세요.",
        parsed.error.flatten(),
        "AUTH_LOOKUP_INVALID",
      );
    }

    const result = await lookupUserByEmailForActivation(parsed.data.email);
    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
