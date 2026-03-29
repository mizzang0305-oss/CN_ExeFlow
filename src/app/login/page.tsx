import { redirect } from "next/navigation";

import { LoginForm } from "@/components";
import { getCurrentSession, getDefaultAppRoute } from "@/features/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect(getDefaultAppRoute(session.role));
  }

  return (
    <main className="app-container flex min-h-screen items-center py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="panel-soft hidden min-h-[620px] flex-col justify-between overflow-hidden p-10 lg:flex">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-700 text-white">
                CN
              </span>
              <div>
                <p>씨엔푸드 내부 운영 시스템</p>
                <p className="text-xs font-medium text-ink-500">CN EXEFLOW</p>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-ink-950">
                대표 지시부터 현장 증빙, 승인과 주간 결산까지 한 흐름으로 연결합니다.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-ink-700">
                CN EXEFLOW는 회의록 앱이 아니라 실행 통제 시스템입니다. 현장은 빠르게 기록하고,
                대표는 숫자와 리스크를 먼저 판단할 수 있도록 구성했습니다.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["현장 우선", "모바일에서도 10초 안에 행동 기록과 증빙 첨부가 가능하도록 설계합니다."],
              ["긴급 우선", "긴급 지시는 항상 먼저 보이고, 지연과 승인 대기는 분명하게 드러납니다."],
              ["숫자 중심", "대표 화면은 설명보다 상태와 숫자, 리스크를 먼저 보여줍니다."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-3xl border border-white/70 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]"
              >
                <p className="text-sm font-semibold text-ink-950">{title}</p>
                <p className="mt-2 text-sm leading-6 text-ink-700">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
