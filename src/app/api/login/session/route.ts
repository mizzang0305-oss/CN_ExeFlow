import { handleApiError } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    throw new ApiError(
      410,
      "이전 사용자 선택 로그인은 더 이상 지원하지 않습니다. 이메일 로그인 화면을 이용해주세요.",
      null,
      "LEGACY_LOGIN_DISABLED",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
