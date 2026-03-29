import { getCurrentSession } from "@/features/auth";
import {
  createDirectiveLogAsSession,
  logPayloadSchema,
} from "@/features/directives";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type DirectiveLogsRouteContext = {
  params: Promise<{
    directiveId: string;
  }>;
};

export async function POST(
  request: Request,
  context: DirectiveLogsRouteContext,
) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { directiveId } = await context.params;
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
        { error: parsed.error.issues[0]?.message ?? "행동 로그 입력값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const result = await createDirectiveLogAsSession(
      session,
      {
        ...parsed.data,
        directiveId,
      },
      formData.getAll("attachments"),
    );

    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
