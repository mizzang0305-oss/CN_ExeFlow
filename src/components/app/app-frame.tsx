import type { AppSession } from "@/features/auth/types";
import { canAccessApprovalQueue, isAdminRole } from "@/features/auth/utils";

import { AppHeader } from "./app-header";
import { RoleRouteGuard } from "./role-route-guard";
import { SessionTelemetryBridge } from "./session-telemetry-bridge";
import type { NavigationItem } from "./top-nav";

type AppFrameProps = {
  children: React.ReactNode;
  currentPath: string;
  description?: string;
  enforceRoleHome?: boolean;
  session: AppSession;
  title: string;
};

function getNavigationItems(session: AppSession): NavigationItem[] {
  if (isAdminRole(session.role)) {
    return [
      { href: "/dashboard/ceo", label: "CEO 대시보드" },
      { href: "/directives", label: "지시 관리" },
      { href: "/directives/approval-queue", label: "승인 대기" },
      { href: "/reports", label: "주간 보고" },
      { href: "/admin/auth-logs", label: "접속 로그" },
      { href: "/admin/activity-logs", label: "활동 로그" },
      { href: "/admin/notification-logs", label: "알림 로그" },
      { href: "/admin/master/departments", label: "조직 설정" },
    ];
  }

  if (session.role === "DEPARTMENT_HEAD") {
    return [
      { href: "/board", label: "부서 실행 보드" },
      { href: "/directives", label: "지시 현황" },
      { href: "/reports", label: "주간 보고" },
    ];
  }

  if (session.role === "STAFF") {
    return [
      { href: "/workspace", label: "내 실행 공간" },
      { href: "/directives", label: "지시 현황" },
      { href: "/reports", label: "주간 보고" },
    ];
  }

  const items: NavigationItem[] = [
    { href: "/viewer", label: "조회 홈" },
    { href: "/directives", label: "지시 조회" },
    { href: "/reports", label: "주간 보고" },
  ];

  if (canAccessApprovalQueue(session.role)) {
    items.splice(2, 0, { href: "/directives/approval-queue", label: "승인 대기" });
  }

  return items;
}

export function AppFrame({
  children,
  currentPath,
  description,
  enforceRoleHome = false,
  session,
  title,
}: AppFrameProps) {
  const navigationItems = getNavigationItems(session);

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(20,73,133,0.14),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(47,130,237,0.12),transparent_24%)]" />

      {enforceRoleHome ? <RoleRouteGuard currentPath={currentPath} role={session.role} /> : null}

      <AppHeader
        currentPath={currentPath}
        description={description}
        navigationItems={navigationItems}
        session={session}
        title={title}
      />

      <SessionTelemetryBridge />

      <main className="app-container relative z-10 py-6 sm:py-8">{children}</main>
    </div>
  );
}
