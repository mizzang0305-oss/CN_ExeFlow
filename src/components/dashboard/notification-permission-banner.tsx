"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { Button, Card } from "@/components";
import type { NotificationPermissionState } from "@/features/notifications/types";

import {
  NOTIFICATION_BANNER_DISMISSED_STORAGE,
  getClientDeviceKey,
  readDeviceRegistrationPayload,
  readNotificationPermission,
  setStoredPushToken,
} from "@/components/app/device-client";

type BannerState = "idle" | "granted" | "hidden" | "unsupported";

function postJson(url: string, body: object) {
  return fetch(url, {
    body: JSON.stringify(body),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

async function syncDevice(permission: NotificationPermissionState) {
  const registration = readDeviceRegistrationPayload();

  if (permission === "granted" && !registration.pushToken) {
    const previewToken = `preview-web-push:${registration.deviceKey}`;
    setStoredPushToken(previewToken);
    registration.pushToken = previewToken;
  }

  registration.notificationPermission = permission;

  await postJson("/api/user/device", registration);
}

async function trackPermissionActivity(permission: NotificationPermissionState, pagePath: string) {
  await postJson("/api/activity/track", {
    activityType: permission === "granted" ? "NOTIFICATION_PERMISSION_GRANTED" : "NOTIFICATION_PERMISSION_DENIED",
    metadata: {
      deviceKey: getClientDeviceKey(),
      permission,
    },
    pagePath,
    targetType: "notification-permission",
  });
}

export function NotificationPermissionBanner() {
  const pathname = usePathname();
  const [isPending, setIsPending] = useState(false);
  const [bannerState, setBannerState] = useState<BannerState>("hidden");

  useEffect(() => {
    const permission = readNotificationPermission();
    const dismissed = window.localStorage.getItem(NOTIFICATION_BANNER_DISMISSED_STORAGE) === "true";

    if (permission === "unsupported") {
      setBannerState("unsupported");
      return;
    }

    if (permission === "granted") {
      setBannerState("granted");
      return;
    }

    if (dismissed || permission === "denied") {
      setBannerState("hidden");
      return;
    }

    setBannerState("idle");
  }, []);

  const isVisible = useMemo(() => bannerState === "idle" || bannerState === "granted", [bannerState]);

  if (!isVisible) {
    return null;
  }

  async function handleAllowNotifications() {
    if (typeof Notification === "undefined") {
      setBannerState("unsupported");
      return;
    }

    setIsPending(true);

    try {
      const permission = (await Notification.requestPermission()) as NotificationPermissionState;
      try {
        await syncDevice(permission);
      } catch (error) {
        console.error("[notification-permission-banner] device sync failed", error);
      }

      if (permission === "granted" || permission === "denied") {
        try {
          await trackPermissionActivity(permission, pathname || "/dashboard");
        } catch (error) {
          console.error("[notification-permission-banner] activity track failed", error);
        }
      }

      window.localStorage.setItem(NOTIFICATION_BANNER_DISMISSED_STORAGE, "true");
      setBannerState(permission === "granted" ? "granted" : "hidden");
    } finally {
      setIsPending(false);
    }
  }

  function handleDismiss() {
    window.localStorage.setItem(NOTIFICATION_BANNER_DISMISSED_STORAGE, "true");
    setBannerState("hidden");
  }

  return (
    <Card className="border-brand-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,245,255,0.92))]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink-950">
            알림을 허용하면 지시사항 배정과 승인 요청을 빠르게 확인할 수 있습니다.
          </p>
          <p className="text-sm leading-6 text-ink-700">
            홈 화면에 추가하면 앱처럼 더 빠르게 사용할 수 있습니다.
          </p>
          {bannerState === "granted" ? (
            <p className="text-sm font-medium text-brand-700">이 디바이스의 알림 준비가 저장되었습니다.</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {bannerState === "idle" ? (
            <Button onClick={() => void handleAllowNotifications()} isLoading={isPending} loadingLabel="권한 확인 중">
              알림 허용
            </Button>
          ) : null}
          <Button variant="secondary" onClick={handleDismiss}>
            {bannerState === "granted" ? "배너 닫기" : "나중에"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
