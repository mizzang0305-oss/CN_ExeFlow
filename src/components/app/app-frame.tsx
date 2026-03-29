import Link from "next/link";

import type { AppSession } from "@/features/auth/types";
import { isExecutiveRole } from "@/features/auth/utils";

import { LogoutButton } from "./logout-button";

type AppFrameProps = {
  children: React.ReactNode;
  currentPath: "/dashboard" | "/directives" | "/reports";
  description?: string;
  session: AppSession;
  title: string;
};

export function AppFrame({
  children,
  currentPath,
  description,
  session,
  title,
}: AppFrameProps) {
  const navigationItems = isExecutiveRole(session.role)
    ? [
        { href: "/dashboard", label: "대시보드" },
        { href: "/directives", label: "지시사항" },
        { href: "/reports", label: "리포트" },
      ]
    : [{ href: "/directives", label: "지시사항" }];

  return (
    <div className="min-h-screen pb-10">
      <header className="border-b border-white/60 bg-white/88 backdrop-blur">
        <div className="app-container flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link href={currentPath} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
              CN EXEFLOW
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-ink-950 sm:text-2xl">{title}</h1>
              {description ? <p className="mt-1 text-sm text-ink-700">{description}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <nav className="flex flex-wrap gap-2">
              {navigationItems.map((item) => {
                const isActive = item.href === currentPath;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      isActive
                        ? "rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-ink-200 transition hover:bg-ink-100"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-ink-950">{session.name}</p>
                <p className="text-xs text-ink-500">
                  {session.departmentName ?? "미지정 부서"} · {session.role}
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
