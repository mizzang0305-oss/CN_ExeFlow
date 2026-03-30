import { LoadingOverlay } from "@/components";

export default function LoginLoading() {
  return (
    <LoadingOverlay
      message="로그인 화면을 준비하고 있습니다"
      submessage="부서와 사용자 기준정보, 로그인 세션 상태를 확인하고 있습니다."
    />
  );
}
