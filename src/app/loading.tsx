import { LoadingOverlay } from "@/components";

export default function RootLoading() {
  return (
    <LoadingOverlay
      message="실행 현황을 불러오는 중"
      submessage="대표 지시와 부서 실행 데이터를 정리하고 있습니다."
    />
  );
}
