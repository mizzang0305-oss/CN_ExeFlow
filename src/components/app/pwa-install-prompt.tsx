"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_UNTIL_KEY = "cn.pwa-install-dismiss-until";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(userAgent) && /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
}

function isDismissed() {
  const dismissedUntil = Number(window.localStorage.getItem(DISMISS_UNTIL_KEY) ?? "0");
  return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
}

function dismissForAWeek() {
  window.localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + DISMISS_DURATION_MS));
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const canPromptInstall = useMemo(() => Boolean(installEvent), [installEvent]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    if (isStandaloneMode() || isDismissed()) {
      return;
    }

    if (isIosSafari()) {
      setShowIosGuide(true);
      setIsVisible(true);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowIosGuide(false);
      setIsVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function installApp() {
    if (!installEvent) {
      return;
    }

    setIsInstalling(true);

    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      dismissForAWeek();
      setIsVisible(false);
      setInstallEvent(null);
    } finally {
      setIsInstalling(false);
    }
  }

  function dismiss() {
    dismissForAWeek();
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <section
      aria-label="앱 설치 안내"
      className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-[28px] border border-brand-100 bg-white p-5 shadow-[0_24px_70px_rgba(6,18,38,0.18)]"
    >
      <p className="text-lg font-bold text-ink-950">휴대폰에 앱으로 설치할 수 있습니다.</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-ink-700">
        설치하면 다음부터 바로 실행할 수 있습니다.
      </p>
      {showIosGuide ? (
        <p className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-900">
          공유 버튼을 누른 뒤 홈 화면에 추가를 선택해주세요.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={dismiss}>
          나중에
        </Button>
        <Button
          type="button"
          disabled={!canPromptInstall}
          isLoading={isInstalling}
          loadingLabel="확인 중"
          onClick={() => void installApp()}
        >
          앱 설치하기
        </Button>
      </div>
    </section>
  );
}
