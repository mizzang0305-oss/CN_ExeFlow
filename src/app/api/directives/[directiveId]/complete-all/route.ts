import { getCurrentSession } from "@/features/auth";
import { trackUserActivityAsync } from "@/features/activity";
import {
  completeDirectiveAsSuperAdmin,
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
      departmentId: null,
      reason: typeof body.reason === "string" ? body.reason : null,
    });

    if (!parsed.success) {
      return createApiErrorResponse(400, {
        code: "DIRECTIVE_COMPLETE_ALL_INVALID",
        message: parsed.error.issues[0]?.message ?? "통합 완료 입력값이 올바르지 않습니다.",
      });
    }

    const result = await completeDirectiveAsSuperAdmin(session, {
      departmentId: null,
      directiveId,
      reason: parsed.data.reason,
    });

    trackUserActivityAsync({
      activityType: "DIRECTIVE_LOG_CREATE",
      metadata: {
        directiveId,
        logId: result.logId,
        mode: "SUPER_ADMIN_COMPLETE_ALL",
      },
      pagePath: `/directives/${directiveId}`,
      session,
      targetId: directiveId,
      targetType: "directive",
    });

    return createApiSuccessResponse({
      directiveId,
      logId: result.logId,
      status: result.directiveStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
