import { clearAppSession } from "@/features/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearAppSession();
    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
