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
      { href: "/admin/master/departments", label: "부서 기준정보" },
      { href: "/admin/master/users", label: "사용자 기준정보" },
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
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(243,246,251,0.96),rgba(248,250,252,1))] pb-12">
      <header className="sticky top-0 z-30 border-b border-brand-100/70 bg-white/88 backdrop-blur-xl">
        <div className="app-container flex flex-col gap-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Link
              href={isExecutiveRole(session.role) ? "/dashboard" : currentPath}
              className="inline-flex items-center gap-3"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-950 text-sm font-bold text-white shadow-[0_16px_28px_rgba(12,31,71,0.24)]">
                CN
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-brand-900">CN FOOD</p>
                <p className="text-xs font-medium text-ink-500">CN EXEFLOW</p>
              </div>
            </Link>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{title}</h1>
              {description ? <p className="mt-1 text-sm leading-6 text-ink-700">{description}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <nav className="flex flex-wrap gap-2 rounded-[26px] border border-ink-200/80 bg-white/90 p-1.5 shadow-[0_12px_30px_rgba(18,24,38,0.06)]">
              {navigationItems.map((item) => {
                const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      isActive
                        ? "rounded-full bg-brand-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(12,31,71,0.24)]"
                        : "rounded-full px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-brand-50 hover:text-brand-900"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-2xl border border-brand-100 bg-brand-50/85 px-4 py-3 text-right shadow-[0_8px_20px_rgba(23,92,211,0.08)]">
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
