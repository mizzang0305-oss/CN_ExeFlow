import { getCurrentSession } from "@/features/auth";
import { trackUserActivityAsync } from "@/features/activity";
import {
  deleteLogSchema,
  logPayloadSchema,
  softDeleteDirectiveLogAsSession,
  updateDirectiveLogAsSession,
} from "@/features/directives";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
  handleApiError,
  readJsonBody,
} from "@/lib/api";

export const runtime = "nodejs";

type DirectiveLogRouteContext = {
  params: Promise<{
    directiveId: string;
    logId: string;
  }>;
};

export async function DELETE(request: Request, context: DirectiveLogRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { directiveId, logId } = await context.params;
    const body = await readJsonBody(request, { required: false });
    const parsed = deleteLogSchema.safeParse({
      reason: typeof body.reason === "string" ? body.reason : null,
    });

    if (!parsed.success) {
      return createApiErrorResponse(400, {
        code: "DIRECTIVE_LOG_DELETE_INVALID",
        message: parsed.error.issues[0]?.message ?? "삭제 요청이 올바르지 않습니다.",
      });
    }

    const result = await softDeleteDirectiveLogAsSession(session, {
      ...parsed.data,
      directiveId,
      logId,
    });

    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: DirectiveLogRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { directiveId, logId } = await context.params;
    const formData = await request.formData();
    const files = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0 && Boolean(value.name));
    const payload = {
      actionSummary: String(formData.get("actionSummary") ?? ""),
      departmentId: String(formData.get("departmentId") ?? "") || null,
      detail: String(formData.get("detail") ?? "") || null,
      happenedAt: String(formData.get("happenedAt") ?? ""),
      logType: String(formData.get("logType") ?? ""),
      nextAction: String(formData.get("nextAction") ?? "") || null,
      riskNote: String(formData.get("riskNote") ?? "") || null,
    };

    const parsed = logPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      return createApiErrorResponse(400, {
        code: "DIRECTIVE_LOG_UPDATE_INVALID",
        message: parsed.error.issues[0]?.message ?? "수정 입력값이 올바르지 않습니다.",
      });
    }

    const result = await updateDirectiveLogAsSession(
      session,
      {
        ...parsed.data,
        directiveId,
        logId,
      },
      formData.getAll("attachments"),
    );

    if (files.length > 0) {
      trackUserActivityAsync({
        activityType: "ATTACHMENT_UPLOAD",
        metadata: {
          attachmentCount: files.length,
          directiveId,
          logId,
        },
        pagePath: `/directives/${directiveId}`,
        session,
        targetId: directiveId,
        targetType: "directive",
      });
    }

    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
