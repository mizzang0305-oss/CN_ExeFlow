import Link from "next/link";

import type { AppSession } from "@/features/auth/types";
import { isAdminRole, isExecutiveRole, roleLabelMap } from "@/features/auth/utils";

import { LogoutButton } from "./logout-button";

type AppFrameProps = {
  children: React.ReactNode;
  currentPath: string;
  description?: string;
  session: AppSession;
  title: string;
};

function getNavigationItems(session: AppSession) {
  if (isAdminRole(session.role)) {
    return [
      { href: "/dashboard", label: "대표 대시보드" },
      { href: "/directives", label: "지시사항" },
      { href: "/reports", label: "주간 결산" },
      { href: "/admin/master/departments", label: "조직 운영도구" },
    ];
  }

  if (session.role === "DEPARTMENT_HEAD") {
    return [
      { href: "/board", label: "부서 실행보드" },
      { href: "/directives", label: "지시사항" },
      { href: "/reports", label: "주간 결산" },
    ];
  }

  if (session.role === "VIEWER") {
    return [
      { href: "/dashboard", label: "조회 대시보드" },
      { href: "/reports", label: "주간 결산" },
    ];
  }

  return [
    { href: "/directives", label: "내 실행 현황" },
    { href: "/reports", label: "주간 결산" },
  ];
}

export function AppFrame({ children, currentPath, description, session, title }: AppFrameProps) {
  const navigationItems = getNavigationItems(session);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(241,245,249,0.96),rgba(248,250,252,1))] pb-12">
      <header className="border-b border-brand-100 bg-white/92 backdrop-blur">
        <div className="app-container flex flex-col gap-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Link
              href={isExecutiveRole(session.role) ? "/dashboard" : currentPath}
              className="inline-flex items-center gap-3"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-sm font-bold text-white shadow-[0_12px_24px_rgba(15,51,117,0.24)]">
                CN
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-brand-700">CN FOOD</p>
                <p className="text-xs font-medium text-ink-500">CN EXEFLOW</p>
              </div>
            </Link>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{title}</h1>
              {description ? <p className="mt-1 text-sm leading-6 text-ink-700">{description}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <nav className="flex flex-wrap gap-2">
              {navigationItems.map((item) => {
                const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      isActive
                        ? "rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,51,117,0.18)]"
                        : "rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-ink-200 transition hover:bg-brand-50"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-50 px-4 py-3 text-right">
                <p className="text-sm font-semibold text-ink-950">{session.displayName}</p>
                <p className="text-xs text-ink-500">
                  {session.departmentName ?? "미배정"} · {roleLabelMap[session.role]}
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="app-container py-6 sm:py-8">{children}</main>
    </div>
  );
}
