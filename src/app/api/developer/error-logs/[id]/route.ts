import { getCurrentSession } from "@/features/auth";
import { updateDeveloperErrorLogAsSession, type DeveloperErrorStatus } from "@/features/developer";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";

type DeveloperErrorLogRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeStatus(value: unknown): DeveloperErrorStatus {
  if (value === "IN_PROGRESS" || value === "RESOLVED") {
    return value;
  }

  return "OPEN";
}

export async function PATCH(request: Request, context: DeveloperErrorLogRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { id } = await context.params;
    const body = await readJsonBody(request);
    const log = await updateDeveloperErrorLogAsSession(session, id, {
      resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote : null,
      status: normalizeStatus(body.status),
    });

    return createApiSuccessResponse(log);
  } catch (error) {
    return handleApiError(error);
  }
}
