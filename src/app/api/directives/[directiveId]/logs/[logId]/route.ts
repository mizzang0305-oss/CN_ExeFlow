import { getCurrentSession } from "@/features/auth";
import {
  deleteLogSchema,
  logPayloadSchema,
  softDeleteDirectiveLogAsSession,
  updateDirectiveLogAsSession,
} from "@/features/directives";
import { handleApiError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";

type DirectiveLogDeleteRouteContext = {
  params: Promise<{
    directiveId: string;
    logId: string;
  }>;
};

export async function DELETE(
  request: Request,
  context: DirectiveLogDeleteRouteContext,
) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { directiveId, logId } = await context.params;
    const body = await readJsonBody(request, { required: false });
    const parsed = deleteLogSchema.safeParse({
      deletedBy: session.userId,
      reason: typeof body.reason === "string" ? body.reason : null,
    });

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "삭제 요청이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const result = await softDeleteDirectiveLogAsSession(session, {
      ...parsed.data,
      directiveId,
      logId,
    });

    return Response.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: DirectiveLogDeleteRouteContext,
) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { directiveId, logId } = await context.params;
    const formData = await request.formData();
    const payload = {
      actionSummary: String(formData.get("actionSummary") ?? ""),
      departmentId: String(formData.get("departmentId") ?? session.departmentId ?? ""),
      detail: String(formData.get("detail") ?? "") || null,
      happenedAt: String(formData.get("happenedAt") ?? ""),
      logType: String(formData.get("logType") ?? ""),
      nextAction: String(formData.get("nextAction") ?? "") || null,
      riskNote: String(formData.get("riskNote") ?? "") || null,
      taskId: String(formData.get("taskId") ?? "") || null,
      userId: session.userId,
    };
    const parsed = logPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "수정 입력값이 올바르지 않습니다." },
        { status: 400 },
      );
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

    return Response.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
