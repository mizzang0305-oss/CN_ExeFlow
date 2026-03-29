import type { AppSession } from "@/features/auth/types";
import { canAccessApprovalQueue, isAdminRole } from "@/features/auth/utils";

import { AppHeader } from "./app-header";
import type { NavigationItem } from "./top-nav";

type AppFrameProps = {
  children: React.ReactNode;
  currentPath: string;
  description?: string;
  session: AppSession;
  title: string;
};

function getNavigationItems(session: AppSession): NavigationItem[] {
  if (isAdminRole(session.role)) {
    return [
      { href: "/dashboard", label: "대표 대시보드" },
      { href: "/directives", label: "지시 관리" },
      { href: "/directives/approval-queue", label: "승인 대기 큐" },
      { href: "/reports", label: "주간 결산" },
      { href: "/admin/master/departments", label: "조직 운영 도구" },
    ];
  }

  if (session.role === "DEPARTMENT_HEAD") {
    return [
      { href: "/board", label: "부서 실행보드" },
      { href: "/directives", label: "지시 관리" },
      { href: "/reports", label: "주간 결산" },
    ];
  }

  if (session.role === "VIEWER") {
    return [
      { href: "/dashboard", label: "조회 대시보드" },
      { href: "/reports", label: "주간 결산" },
    ];
  }

  const baseItems: NavigationItem[] = [
    { href: "/directives", label: "실행 현황" },
    { href: "/reports", label: "주간 결산" },
  ];

  if (canAccessApprovalQueue(session.role)) {
    return [...baseItems, { href: "/directives/approval-queue", label: "승인 대기 큐" }];
  }

  return baseItems;
}

export function AppFrame({ children, currentPath, description, session, title }: AppFrameProps) {
  const navigationItems = getNavigationItems(session);

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(20,73,133,0.14),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(47,130,237,0.12),transparent_24%)]" />

      <AppHeader
        currentPath={currentPath}
        description={description}
        navigationItems={navigationItems}
        session={session}
        title={title}
      />

      <main className="app-container relative z-10 py-6 sm:py-8">{children}</main>
    </div>
  );
}
