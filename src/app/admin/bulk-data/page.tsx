import { redirect } from "next/navigation";

import { AppFrame } from "@/components";
import { BulkDataManagementClient } from "@/components/admin/bulk-data-management-client";
import { getCurrentSession } from "@/features/auth";
import { isAdminRole } from "@/features/auth/utils";
import { getBulkDirectiveManagementDataAsSession } from "@/features/bulk-directives";

export const dynamic = "force-dynamic";

export default async function BulkDataManagementPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdminRole(session.role)) {
    return (
      <AppFrame
        currentPath="/admin/bulk-data"
        session={session}
        title="데이터 일괄관리"
        description="엑셀 일괄등록과 비노출 처리는 승인권자만 사용할 수 있습니다."
      >
        <section className="rounded-[30px] border border-white/80 bg-white p-8 text-center shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
          <h2 className="text-2xl font-bold text-ink-950">접근 권한이 없습니다.</h2>
          <p className="mt-3 text-sm font-semibold text-ink-700">
            데이터 일괄관리는 대표와 슈퍼관리자만 사용할 수 있습니다.
          </p>
        </section>
      </AppFrame>
    );
  }

  const data = await getBulkDirectiveManagementDataAsSession(session);

  return (
    <AppFrame
      currentPath="/admin/bulk-data"
      session={session}
      title="데이터 일괄관리"
      description="지시사항을 엑셀로 검증한 뒤 선택 등록하고, 잘못 등록된 묶음은 화면에서 숨깁니다."
    >
      <BulkDataManagementClient initialData={data} />
    </AppFrame>
  );
}
