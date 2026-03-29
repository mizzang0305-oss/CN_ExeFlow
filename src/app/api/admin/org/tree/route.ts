import { requireAdminApiSession } from "@/features/auth";
import { listOrgTreeData } from "@/features/master";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdminApiSession();
    const data = await listOrgTreeData();
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
