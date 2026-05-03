import { AppFrame } from "@/components";
import { DeveloperToolsClient } from "@/components/developer/developer-tools-client";
import { requireCurrentSession } from "@/features/auth";
import { listDeveloperErrorLogsAsSession } from "@/features/developer";

export const dynamic = "force-dynamic";

export default async function DeveloperToolsPage() {
  const session = await requireCurrentSession();

  if (session.role !== "SUPER_ADMIN") {
    return (
      <AppFrame
        currentPath="/developer"
        session={session}
        title="개발자 도구"
        description="운영 오류를 확인하고 조치 상태를 관리합니다."
      >
        <section className="rounded-[30px] border border-white/80 bg-white p-8 text-center shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
          <h2 className="text-2xl font-bold text-ink-950">접근 권한이 없습니다.</h2>
          <p className="mt-3 text-sm font-semibold text-ink-700">슈퍼관리자만 개발자 도구를 사용할 수 있습니다.</p>
        </section>
      </AppFrame>
    );
  }

  const logs = await listDeveloperErrorLogsAsSession(session);

  return (
    <AppFrame
      currentPath="/developer"
      session={session}
      title="개발자 도구"
      description="오류 로그, 사용자 정보, 발생 경로와 조치 상태를 한 화면에서 관리합니다."
    >
      <DeveloperToolsClient initialLogs={logs} />
    </AppFrame>
  );
}
