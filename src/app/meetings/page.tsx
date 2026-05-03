import { AppFrame } from "@/components";
import { MeetingManagementClient } from "@/components/meetings/meeting-management-client";
import { requireAdminSession } from "@/features/auth";
import { getMeetingManagementDataAsSession } from "@/features/meetings";

export const dynamic = "force-dynamic";

export default async function MeetingManagementPage() {
  const session = await requireAdminSession();
  const data = await getMeetingManagementDataAsSession(session);

  return (
    <AppFrame
      currentPath="/meetings"
      session={session}
      title="회의실 입장"
      description="회의 내용을 저장하고 지시 후보를 분석한 뒤 부서별 지시사항으로 등록합니다."
    >
      <MeetingManagementClient initialData={data} />
    </AppFrame>
  );
}
