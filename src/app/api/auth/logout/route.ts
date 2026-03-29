import { clearAppSession } from "@/features/auth";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";

export async function POST() {
  try {
    await clearAppSession();
    return createApiSuccessResponse({ loggedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
