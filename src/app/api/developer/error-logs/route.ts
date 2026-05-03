import { getCurrentSession } from "@/features/auth";
import {
  createDeveloperErrorLog,
  listDeveloperErrorLogsAsSession,
  type DeveloperErrorLogInput,
} from "@/features/developer";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    const body = await readJsonBody(request);
    const log = await createDeveloperErrorLog(
      {
        appState: typeof body.appState === "object" && body.appState !== null ? body.appState as Record<string, unknown> : {},
        browserInfo: typeof body.browserInfo === "object" && body.browserInfo !== null ? body.browserInfo as Record<string, unknown> : {},
        level: readString(body.level) || "ERROR",
        message: readString(body.message),
        routePath: readString(body.routePath) || null,
        screenshotData: readString(body.screenshotData) || null,
        screenshotUrl: readString(body.screenshotUrl) || null,
        source: readString(body.source) || "CLIENT",
        stack: readString(body.stack) || null,
      } satisfies DeveloperErrorLogInput,
      session,
    );

    return createApiSuccessResponse(log, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const logs = await listDeveloperErrorLogsAsSession(session);
    return createApiSuccessResponse({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
