import { createApiSuccessResponse, handleApiError } from "@/lib/api";
import { previewBulkDirectivesAsSession } from "@/features/bulk-directives";
import { requireAdminApiSession } from "@/features/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    const formData = await request.formData();
    const file = formData.get("file");

    const result = await previewBulkDirectivesAsSession(session, file instanceof File ? file : null);

    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
