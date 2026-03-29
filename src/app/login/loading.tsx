import { LoadingOverlay } from "@/components";

export default function LoginLoading() {
  return (
    <LoadingOverlay
      message="운영 플랫폼 진입 준비 중"
      submessage="부서와 사용자 권한을 정렬해 로그인 흐름을 준비하고 있습니다."
    />
  );
}
