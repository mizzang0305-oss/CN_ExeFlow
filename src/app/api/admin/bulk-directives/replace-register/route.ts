import { requireAdminApiSession } from "@/features/auth";
import { bulkDirectiveReplaceRegisterSchema, registerReplaceDirectivesAsSession } from "@/features/bulk-directives";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    const body = await readJsonBody(request);
    const input = bulkDirectiveReplaceRegisterSchema.parse(body);
    const result = await registerReplaceDirectivesAsSession(session, input);

    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
