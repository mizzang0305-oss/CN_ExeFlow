import { clearAppSession, getCurrentSession } from "@/features/auth";
import { trackAuthActivityAsync } from "@/features/activity";
import { createApiSuccessResponse, handleApiError } from "@/lib/api";
import { readRequestClientContext } from "@/lib/request-context";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    const requestContext = readRequestClientContext(request);

    await clearAppSession();

    if (session) {
      trackAuthActivityAsync({
        deviceType: requestContext.deviceType,
        email: session.email,
        eventResult: "SUCCESS",
        eventType: "LOGOUT",
        ipAddress: requestContext.ipAddress,
        platform: requestContext.platform,
        userAgent: requestContext.userAgent,
        userId: session.userId,
      });
    }

    return createApiSuccessResponse({ loggedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
