import { getCurrentSession } from "@/features/auth";
import { getDirectiveDetailForSession } from "@/features/directives";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type DirectiveRouteContext = {
  params: Promise<{
    directiveId: string;
  }>;
};

export async function GET(_request: Request, context: DirectiveRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { directiveId } = await context.params;
    const data = await getDirectiveDetailForSession(session, directiveId);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
