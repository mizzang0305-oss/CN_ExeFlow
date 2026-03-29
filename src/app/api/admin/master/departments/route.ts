import { requireAdminSession } from "@/features/auth";
import {
  createDepartment,
  departmentUpsertSchema,
  listMasterLookupData,
} from "@/features/master";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdminSession();
    const data = await listMasterLookupData();
    return createApiSuccessResponse({ departments: data.departments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = await readJsonBody(request);
    const parsed = departmentUpsertSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "부서 입력값을 다시 확인해 주세요.",
        parsed.error.flatten(),
        "MASTER_DEPARTMENT_INVALID",
      );
    }

    const data = await createDepartment(parsed.data, session.userId);
    return createApiSuccessResponse(data, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
