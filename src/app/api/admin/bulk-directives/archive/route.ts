import { requireAdminApiSession } from "@/features/auth";
import { archiveBulkDirectivesAsSession, bulkDirectiveArchiveSchema } from "@/features/bulk-directives";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    const body = await readJsonBody(request);
    const input = bulkDirectiveArchiveSchema.parse(body);
    const result = await archiveBulkDirectivesAsSession(session, input);

    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
