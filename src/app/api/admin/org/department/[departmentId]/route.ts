import { requireAdminApiSession } from "@/features/auth";
import { departmentUpsertSchema, listOrgTreeData, updateDepartment } from "@/features/master";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

type DepartmentRouteContext = {
  params: Promise<{
    departmentId: string;
  }>;
};

export async function PATCH(request: Request, context: DepartmentRouteContext) {
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

    const { departmentId } = await context.params;
    await updateDepartment(departmentId, parsed.data, session.userId);
    return createApiSuccessResponse(await listOrgTreeData());
  } catch (error) {
    return handleApiError(error);
  }
}
