import { getCurrentSession } from "@/features/auth";
import { analyzeMeetingAsSession } from "@/features/meetings";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type MeetingAnalyzeRouteContext = {
  params: Promise<{
    meetingId: string;
  }>;
};

export async function POST(_request: Request, context: MeetingAnalyzeRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { meetingId } = await context.params;
    const drafts = await analyzeMeetingAsSession(session, meetingId);

    return createApiSuccessResponse({
      drafts,
      message: "회의내용 분석이 완료되었습니다.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
