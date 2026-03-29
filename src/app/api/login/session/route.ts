import { createApiErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

export async function POST() {
  return createApiErrorResponse(410, {
    code: "LEGACY_LOGIN_DISABLED",
    message: "이전 사용자 선택 로그인은 종료되었습니다. 이메일 로그인 또는 최초 사용자 설정을 이용해주세요.",
  });
}
