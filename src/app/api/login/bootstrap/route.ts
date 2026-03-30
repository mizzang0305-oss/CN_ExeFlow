import { getInitialSetupBootstrapData } from "@/features/auth";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getInitialSetupBootstrapData();
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
