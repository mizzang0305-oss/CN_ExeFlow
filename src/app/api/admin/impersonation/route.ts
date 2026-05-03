import {
  getCurrentActorSession,
  listImpersonationUsersAsSession,
  startImpersonationAsSession,
  stopImpersonationAsSession,
} from "@/features/auth";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
  handleApiError,
  readJsonBody,
} from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentActorSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const users = await listImpersonationUsersAsSession(session);
    return createApiSuccessResponse({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentActorSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const body = await readJsonBody(request);
    const userId = typeof body.userId === "string" ? body.userId : "";

    if (!userId) {
      return createApiErrorResponse(400, {
        code: "IMPERSONATION_USER_REQUIRED",
        message: "전환할 사용자를 선택해주세요.",
      });
    }

    const result = await startImpersonationAsSession(session, userId);
    return createApiSuccessResponse({
      ...result,
      message: "사용자 화면 전환을 시작했습니다.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const result = await stopImpersonationAsSession();
    return createApiSuccessResponse({
      ...result,
      message: "슈퍼관리자 화면으로 돌아갑니다.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
