import { LoadingOverlay } from "@/components";

export default function DashboardEntryLoading() {
  return (
    <LoadingOverlay
      message="권한에 맞는 화면으로 이동하는 중"
      submessage="사용자 역할을 확인하고 올바른 실행 화면을 연결하고 있습니다."
    />
  );
}
