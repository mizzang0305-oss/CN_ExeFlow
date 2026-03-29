import { getCurrentSession } from "@/features/auth";
import {
  createDirectiveLogAsSession,
  logPayloadSchema,
} from "@/features/directives";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type DirectiveLogsRouteContext = {
  params: Promise<{
    directiveId: string;
  }>;
};

export async function POST(request: Request, context: DirectiveLogsRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { directiveId } = await context.params;
    const formData = await request.formData();
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
        code: "DIRECTIVE_LOG_INVALID",
        message: parsed.error.issues[0]?.message ?? "행동 로그 입력값이 올바르지 않습니다.",
      });
    }

    const result = await createDirectiveLogAsSession(
      session,
      {
        ...parsed.data,
        directiveId,
      },
      formData.getAll("attachments"),
    );

    return createApiSuccessResponse(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
