import { LoadingOverlay } from "@/components";

export default function RootLoading() {
  return (
    <LoadingOverlay
      useGif
      message="화면을 준비하고 있습니다"
      submessage="공유 업무 정보를 불러오는 중입니다."
    />
  );
}
