import { trackAuthActivity } from "@/features/activity/service";
import { clearAppSession, getCurrentSession } from "@/features/auth";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";
import { runBackgroundTask } from "@/lib/background-task";
import { readRequestClientContext } from "@/lib/request-context";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    await clearAppSession();

    if (session) {
      const requestContext = readRequestClientContext(request);

      runBackgroundTask("auth-logout", () =>
        trackAuthActivity({
          email: session.email,
          eventResult: "SUCCESS",
          eventType: "LOGOUT",
          requestContext,
          userId: session.userId,
        }),
      );
    }

    return createApiSuccessResponse({ loggedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
