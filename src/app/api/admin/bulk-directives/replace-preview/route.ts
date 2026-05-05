import { requireAdminApiSession } from "@/features/auth";
import { previewReplaceDirectivesAsSession } from "@/features/bulk-directives";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    const formData = await request.formData();
    const file = formData.get("file");

    const result = await previewReplaceDirectivesAsSession(session, file instanceof File ? file : null);

    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
