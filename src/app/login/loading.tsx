import { LoadingOverlay } from "@/components";

export default function LoginLoading() {
  return (
    <LoadingOverlay
      message="로그인 화면을 준비하는 중"
      submessage="회사 이메일과 세션 상태를 확인하고 있습니다."
    />
  );
}
