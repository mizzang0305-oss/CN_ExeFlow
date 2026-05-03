"use client";

import { useEffect } from "react";

type ErrorPayload = {
  message: string;
  source: string;
  stack?: string | null;
};

function buildBrowserInfo() {
  return {
    language: window.navigator.language,
    userAgent: window.navigator.userAgent,
    viewport: {
      height: window.innerHeight,
      width: window.innerWidth,
    },
  };
}

function buildAppState() {
  return {
    currentUrl: window.location.href,
    referrer: document.referrer || null,
    visibilityState: document.visibilityState,
  };
}

async function sendErrorLog(payload: ErrorPayload) {
  try {
    await fetch("/api/developer/error-logs", {
      body: JSON.stringify({
        appState: buildAppState(),
        browserInfo: buildBrowserInfo(),
        level: "ERROR",
        message: payload.message,
        routePath: window.location.pathname,
        source: payload.source,
        stack: payload.stack ?? null,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // 사용자 화면을 보호하기 위해 오류 보고 실패는 조용히 무시한다.
  }
}

export function ErrorReportingClient() {
  useEffect(() => {
    function handleWindowError(event: ErrorEvent) {
      void sendErrorLog({
        message: event.message || "브라우저 오류가 발생했습니다.",
        source: "window.onerror",
        stack: event.error instanceof Error ? event.error.stack ?? null : null,
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      void sendErrorLog({
        message: reason instanceof Error ? reason.message : "처리되지 않은 비동기 오류가 발생했습니다.",
        source: "window.onunhandledrejection",
        stack: reason instanceof Error ? reason.stack ?? null : null,
      });
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
