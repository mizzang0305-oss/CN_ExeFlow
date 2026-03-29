import { createApiSuccessResponse } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return createApiSuccessResponse({
    message: "이전 사용자 선택 조회는 종료되었습니다. 이메일 기준 최초 사용자 설정을 이용해주세요.",
    supported: false,
  });
}
