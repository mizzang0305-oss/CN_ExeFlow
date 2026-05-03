"use client";

import Link from "next/link";
import { useEffect } from "react";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function reportBoundaryError(error: Error & { digest?: string }) {
  return fetch("/api/developer/error-logs", {
    body: JSON.stringify({
      appState: {
        digest: error.digest ?? null,
        currentUrl: window.location.href,
      },
      browserInfo: {
        userAgent: window.navigator.userAgent,
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth,
        },
      },
      level: "ERROR",
      message: error.message || "화면 오류가 발생했습니다.",
      routePath: window.location.pathname,
      source: "next-error-boundary",
      stack: error.stack ?? null,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    void reportBoundaryError(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f3f7fc,#e8f0fa)] p-6">
      <section className="w-full max-w-lg rounded-[30px] border border-white/80 bg-white p-7 text-center shadow-[0_28px_80px_rgba(6,18,38,0.16)]">
        <p className="text-sm font-bold text-brand-700">CN EXEFLOW</p>
        <h1 className="mt-3 text-3xl font-bold text-ink-950">화면을 불러오지 못했습니다.</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-ink-700">
          일시적인 오류가 발생했습니다. 다시 시도해주세요.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-[20px] bg-brand-900 px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(7,32,63,0.22)]"
          >
            다시 불러오기
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-[20px] border border-brand-100 bg-brand-50 px-5 text-sm font-bold text-brand-900"
          >
            홈으로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}
