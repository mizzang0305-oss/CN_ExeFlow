import { requireAdminApiSession } from "@/features/auth";
import { createDepartment, departmentUpsertSchema, listOrgTreeData } from "@/features/master";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    const body = await readJsonBody(request);
    const parsed = departmentUpsertSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "부서 입력값을 다시 확인해 주세요.",
        parsed.error.flatten(),
        "ORG_DEPARTMENT_INVALID",
      );
    }

    await createDepartment(parsed.data, session.userId);
    return createApiSuccessResponse(await listOrgTreeData(), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
