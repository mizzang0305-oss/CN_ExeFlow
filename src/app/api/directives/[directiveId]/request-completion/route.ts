import { getCurrentSession } from "@/features/auth";
import {
  requestDirectiveCompletionAsSession,
  workflowReasonSchema,
} from "@/features/directives";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
  handleApiError,
  readJsonBody,
} from "@/lib/api";

export const runtime = "nodejs";

type WorkflowRouteContext = {
  params: Promise<{
    directiveId: string;
  }>;
};

export async function POST(request: Request, context: WorkflowRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { directiveId } = await context.params;
    const body = await readJsonBody(request, { required: false });
    const parsed = workflowReasonSchema.safeParse({
      departmentId: typeof body.departmentId === "string" ? body.departmentId : null,
      reason: typeof body.reason === "string" ? body.reason : null,
    });

    if (!parsed.success) {
      return createApiErrorResponse(400, {
        code: "DIRECTIVE_WORKFLOW_INVALID",
        message: parsed.error.issues[0]?.message ?? "요청 사유가 올바르지 않습니다.",
      });
    }

    await requestDirectiveCompletionAsSession(session, {
      departmentId: parsed.data.departmentId,
      directiveId,
      reason: parsed.data.reason,
    });

    return createApiSuccessResponse({
      departmentId: parsed.data.departmentId,
      directiveId,
      status: "COMPLETION_REQUESTED",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
