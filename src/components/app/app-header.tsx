import Link from "next/link";

import type { AppSession } from "@/features/auth/types";
import { getDefaultAppRoute, roleLabelMap } from "@/features/auth/utils";

import { StatusPill } from "@/components/ui/status-pill";

import { LogoutButton } from "./logout-button";
import { type NavigationItem, TopNav } from "./top-nav";

type AppHeaderProps = {
  currentPath: string;
  description?: string;
  navigationItems: NavigationItem[];
  session: AppSession;
  title: string;
};

export function AppHeader({
  currentPath,
  description,
  navigationItems,
  session,
  title,
}: AppHeaderProps) {
  return (
    <header className="relative overflow-hidden border-b border-brand-950/8 bg-[linear-gradient(180deg,var(--color-brand-950),#0a274b)] text-white shadow-[0_28px_90px_rgba(3,19,38,0.24)]">
      <div className="pointer-events-none brand-grid absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-brand-500/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[-5rem] h-96 w-96 rounded-full bg-brand-700/30 blur-3xl" />

      <div className="app-container relative py-5 sm:py-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={getDefaultAppRoute(session.role)} className="inline-flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))] text-sm font-bold tracking-[0.18em] text-white shadow-[0_18px_34px_rgba(47,130,237,0.28)]">
                  CN
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-[0.22em] text-brand-100">씨엔푸드</p>
                  <p className="text-xs font-medium text-white/60">실행 통제 시스템</p>
                </div>
              </Link>

              <StatusPill tone="muted">대표 지시 기반 실행 통제</StatusPill>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.26em] text-brand-100/70 uppercase">
                실행 통제 플랫폼
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">{title}</h1>
              {description ? <p className="max-w-3xl text-sm leading-7 text-white/74">{description}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill tone="muted">{roleLabelMap[session.role]}</StatusPill>
              <StatusPill tone="muted">{session.departmentName ?? "미배정 부서"}</StatusPill>
              <StatusPill tone="muted">실행 · 증빙 · 승인 · 결산</StatusPill>
            </div>
          </div>

          <div className="flex w-full max-w-[48rem] flex-col gap-4 xl:items-end">
            <TopNav currentPath={currentPath} items={navigationItems} />

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex min-h-[76px] flex-1 items-center justify-between rounded-[28px] border border-white/12 bg-white/8 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
                <div>
                  <p className="text-sm font-semibold text-white">{session.displayName}</p>
                  <p className="mt-1 text-xs text-white/64">
                    {session.title ? `${session.title} · ` : ""}
                    {roleLabelMap[session.role]}
                  </p>
                </div>

                <div className="space-y-2 text-right">
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-100/72 uppercase">
                    실시간 우선순위
                  </p>
                  <div className="loading-bar h-2 w-24 rounded-full bg-white/10">
                    <div className="h-full w-3/4 rounded-full bg-[linear-gradient(90deg,var(--color-brand-500),#93c5fd)]" />
                  </div>
                </div>
              </div>

              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
