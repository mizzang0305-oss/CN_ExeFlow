import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle, LoginForm } from "@/components";
import { getCurrentSession, getDefaultAppRoute, listLoginOptions } from "@/features/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect(getDefaultAppRoute(session.role));
  }

  let departments = [] as Awaited<ReturnType<typeof listLoginOptions>>;
  let errorMessage: string | null = null;

  try {
    departments = await listLoginOptions();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "로그인 화면을 준비하지 못했습니다.";
  }

  return (
    <main className="app-container flex min-h-screen items-center justify-center py-10">
      {errorMessage ? (
        <Card className="max-w-xl space-y-3">
          <CardTitle>로그인 화면을 불러오지 못했습니다</CardTitle>
          <CardDescription>
            Supabase 연결 또는 기본 데이터 설정을 확인해 주세요.
          </CardDescription>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel-soft hidden p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-4">
              <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                실행 통제 시스템
              </span>
              <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-ink-950">
                대표 지시부터 현장 증빙까지, 흐름을 짧고 강하게 연결합니다.
              </h1>
              <p className="max-w-xl text-base leading-7 text-ink-700">
                CN EXEFLOW는 회의록 보관함이 아니라 실행과 증빙, 그리고 확인이 한 흐름으로
                이어지는 운영 시스템입니다.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["현장 우선", "모바일에서 빠르게 행동을 남길 수 있게 설계합니다."],
                ["긴급 강조", "급한 건은 리스트와 대시보드에서 바로 보이게 만듭니다."],
                ["대표 판단", "숫자와 상태를 먼저 보여 주는 운영 대시보드입니다."],
              ].map(([title, description]) => (
                <Card key={title} className="space-y-2 bg-white/90">
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <LoginForm departments={departments} />
          </div>
        </div>
      )}
    </main>
  );
}
