import { LoadingOverlay } from "@/components";

export default function RootLoading() {
  return (
    <LoadingOverlay
      message="CN EXEFLOW 연결 중"
      submessage="대표 지시, 부서 실행, 승인 흐름을 순서대로 정리하고 있습니다."
    />
  );
}
