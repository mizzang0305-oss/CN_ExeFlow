import { initialSetupLookupSchema, lookupUserForInitialSetup } from "@/features/auth";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const parsed = initialSetupLookupSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "부서와 이름을 다시 확인해주세요.",
        parsed.error.flatten(),
        "AUTH_SETUP_LOOKUP_INVALID",
      );
    }

    const result = await lookupUserForInitialSetup(parsed.data);
    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
