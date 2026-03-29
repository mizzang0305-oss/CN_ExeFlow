import {
  createSessionFromUserSelection,
  getCurrentSession,
  getDefaultAppRoute,
  loginSessionSchema,
} from "@/features/auth";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();

    return createApiSuccessResponse({
      redirectTo: session ? getDefaultAppRoute(session.role) : null,
      session,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = loginSessionSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "로그인 정보를 다시 확인해 주세요.",
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
