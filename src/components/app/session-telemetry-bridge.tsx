"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import type { NotificationPermissionState, UserActivityType } from "@/features/activity/types";

const ACTIVITY_THROTTLE_MS = 45 * 1000;
const DEVICE_SYNC_THROTTLE_MS = 15 * 60 * 1000;
const DEVICE_KEY_STORAGE = "cn-exeflow-device-key";
const PUSH_TOKEN_STORAGE = "cn-exeflow-push-token";
const PUSH_PERMISSION_REQUESTED_STORAGE = "cn-exeflow-push-permission-requested";

function readJsonFetch(url: string, body: Record<string, unknown>) {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    method: "POST",
  });
}

function resolvePageActivity(pathname: string): {
  activityType: UserActivityType;
  pagePath: string;
  targetId?: string;
  targetType?: string;
} | null {
  if (pathname === "/dashboard") {
    return {
      activityType: "DASHBOARD_VIEW",
      pagePath: pathname,
    };
  }

  if (pathname === "/directives") {
    return {
      activityType: "DIRECTIVE_LIST_VIEW",
      pagePath: pathname,
    };
  }

  if (pathname === "/directives/approval-queue") {
    return {
      activityType: "APPROVAL_QUEUE_VIEW",
      pagePath: pathname,
    };
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 2 && segments[0] === "directives" && segments[1] !== "new") {
    return {
      activityType: "DIRECTIVE_DETAIL_VIEW",
      pagePath: pathname,
      targetId: segments[1],
      targetType: "directive",
    };
  }

  return null;
}

function resolveDeviceType() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("ipad") || userAgent.includes("tablet")) {
    return "태블릿";
  }

  if (userAgent.includes("mobi") || userAgent.includes("iphone") || userAgent.includes("android")) {
    return "모바일";
  }

  return "데스크톱";
}

function resolvePlatform() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("android")) {
    return "안드로이드";
  }

  if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("ios")) {
    return "iOS";
  }

  if (userAgent.includes("windows")) {
    return "윈도우";
  }

  if (userAgent.includes("mac os") || userAgent.includes("macintosh")) {
    return "맥";
  }

  if (userAgent.includes("linux")) {
    return "리눅스";
  }

  return "웹";
}

function ensureDeviceKey() {
  const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE);

  if (existing) {
    return existing;
  }

  const generated = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_KEY_STORAGE, generated);
  return generated;
}

function shouldThrottle(key: string, minIntervalMs: number) {
  const now = Date.now();
  const lastSentAt = Number(window.localStorage.getItem(key) ?? "0");

  if (now - lastSentAt < minIntervalMs) {
    return true;
  }

  window.localStorage.setItem(key, String(now));
  return false;
}

function readNotificationPermission(): NotificationPermissionState {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission as NotificationPermissionState;
}

async function requestNotificationPermissionIfNeeded() {
  const current = readNotificationPermission();

  if (current === "unsupported" || current !== "default") {
    return current;
  }

  if (window.localStorage.getItem(PUSH_PERMISSION_REQUESTED_STORAGE) === "true") {
    return current;
  }

  window.localStorage.setItem(PUSH_PERMISSION_REQUESTED_STORAGE, "true");

  try {
    return (await Notification.requestPermission()) as NotificationPermissionState;
  } catch {
    return current;
  }
}

export function SessionTelemetryBridge() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const activity = resolvePageActivity(pathname);

    if (!activity) {
      return;
    }

    const throttleKey = `cn-exeflow-activity:${activity.activityType}:${activity.targetId ?? pathname}`;

    if (shouldThrottle(throttleKey, ACTIVITY_THROTTLE_MS)) {
      return;
    }

    void readJsonFetch("/api/activity/track", activity);
  }, [pathname]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const deviceKey = ensureDeviceKey();
    const throttleKey = `cn-exeflow-device-sync:${deviceKey}`;

    if (shouldThrottle(throttleKey, DEVICE_SYNC_THROTTLE_MS)) {
      return;
    }

    const syncDevice = async () => {
      const notificationPermission = await requestNotificationPermissionIfNeeded();

      await readJsonFetch("/api/user/device", {
        deviceKey,
        deviceType: resolveDeviceType(),
        notificationPermission,
        platform: resolvePlatform(),
        pushToken: window.localStorage.getItem(PUSH_TOKEN_STORAGE),
      });
    };

    void syncDevice();
  }, [pathname]);

  return null;
}
