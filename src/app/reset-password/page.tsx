import { Suspense } from "react";

import { ResetPasswordClient } from "@/components/auth/reset-password-client";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#020814,#081425_56%,#0d1d31)] px-6">
          <section className="w-full max-w-xl rounded-[32px] border border-white/90 bg-white/96 p-6 text-center shadow-[0_32px_90px_rgba(3,19,38,0.18)]">
            <p className="text-sm font-bold text-brand-700">CN EXEFLOW</p>
            <h1 className="mt-3 text-2xl font-bold text-ink-950">비밀번호 재설정 화면을 준비하고 있습니다.</h1>
          </section>
        </main>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
