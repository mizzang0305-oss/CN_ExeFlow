import { requireCurrentSession } from "@/features/auth";
import { markNotificationClickedAsSession } from "@/features/activity";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const session = await requireCurrentSession();
    const { notificationId } = await context.params;

    await markNotificationClickedAsSession(session, notificationId);
    return createApiSuccessResponse({ clicked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
