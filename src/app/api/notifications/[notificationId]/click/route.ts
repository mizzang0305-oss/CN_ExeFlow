import { markNotificationClickedAsSession } from "@/features/activity";
import { requireCurrentSession } from "@/features/auth";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const session = await requireCurrentSession();
    const { notificationId } = await context.params;
    await markNotificationClickedAsSession(session, notificationId);
    return createApiSuccessResponse({ clicked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
