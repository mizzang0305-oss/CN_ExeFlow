import { requireCurrentSession } from "@/features/auth";
import { markNotificationReadAsSession } from "@/features/activity";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const session = await requireCurrentSession();
    const { notificationId } = await context.params;

    await markNotificationReadAsSession(session, notificationId);
    return createApiSuccessResponse({ read: true });
  } catch (error) {
    return handleApiError(error);
  }
}
