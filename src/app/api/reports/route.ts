import { getCurrentSession } from "@/features/auth";
import { generateWeeklyReport, getReportsOverview } from "@/features/reports";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const data = await getReportsOverview(session);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const data = await generateWeeklyReport(session);
    return createApiSuccessResponse(data, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
