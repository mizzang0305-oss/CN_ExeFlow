import { getCurrentSession } from "@/features/auth";
import { createFollowUpDirectiveLogAsSession } from "@/features/directives";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type FollowUpsRouteContext = {
  params: Promise<{
    directiveId: string;
  }>;
};

export async function POST(request: Request, context: FollowUpsRouteContext) {
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
    const content = String(formData.get("content") ?? "");
    const dueDate = String(formData.get("dueDate") ?? "") || null;
    const requestDepartmentId = String(formData.get("requestDepartmentId") ?? "") || null;
    const isUrgent = formData.get("isUrgent") === "true";
    const files = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0 && Boolean(value.name));

    const result = await createFollowUpDirectiveLogAsSession(
      session,
      {
        content,
        directiveId,
        dueDate,
        isUrgent,
        requestDepartmentId,
      },
      files,
    );

    return createApiSuccessResponse(
      {
        id: result.id,
        message: "추가 지시가 등록되었습니다.",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
