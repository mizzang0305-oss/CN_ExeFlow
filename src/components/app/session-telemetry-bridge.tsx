"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import type { UserActivityType } from "@/features/activity/types";

const ACTIVITY_THROTTLE_MS = 30 * 1000;
const DEVICE_SYNC_THROTTLE_MS = 30 * 60 * 1000;
const DEVICE_KEY_STORAGE_KEY = "cn-exeflow-device-key";
const DEVICE_SYNC_STORAGE_KEY = "cn-exeflow-device-last-sync";
const NOTIFICATION_PROMPT_STORAGE_KEY = "cn-exeflow-notification-prompted";

type ActivityDescriptor = {
  activityType: UserActivityType;
  pagePath: string;
  targetId?: string | null;
  targetType?: string | null;
} | null;

function inferActivityDescriptor(pathname: string): ActivityDescriptor {
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

  if (
    segments.length === 2 &&
    segments[0] === "directives" &&
    segments[1] !== "new" &&
    segments[1] !== "approval-queue"
  ) {
    return {
      activityType: "DIRECTIVE_DETAIL_VIEW",
      pagePath: pathname,
      targetId: segments[1],
      targetType: "directive",
    };
  }

  return null;
}

function shouldThrottle(storageKey: string, scopeKey: string, windowMs: number) {
  const compositeKey = `${storageKey}:${scopeKey}`;
  const lastValue = window.localStorage.getItem(compositeKey);

  if (!lastValue) {
    window.localStorage.setItem(compositeKey, String(Date.now()));
    return false;
  }

  const lastTime = Number(lastValue);

  if (!Number.isFinite(lastTime) || Date.now() - lastTime >= windowMs) {
    window.localStorage.setItem(compositeKey, String(Date.now()));
    return false;
  }

  return true;
}

function getOrCreateDeviceKey() {
  const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextValue = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, nextValue);
  return nextValue;
}

function inferPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("ios")) {
    return "IOS";
  }

  if (userAgent.includes("android")) {
    return "ANDROID";
  }

  if (userAgent.includes("windows")) {
    return "WINDOWS";
  }

  if (userAgent.includes("macintosh") || userAgent.includes("mac os")) {
    return "MAC";
  }

  if (userAgent.includes("linux")) {
    return "LINUX";
  }

  return "OTHER";
}

function inferDeviceType() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("ipad") || userAgent.includes("tablet")) {
    return "TABLET";
  }

  if (
    userAgent.includes("mobile") ||
    userAgent.includes("iphone") ||
    userAgent.includes("android")
  ) {
    return "MOBILE";
  }

  return "DESKTOP";
}

async function postJson(url: string, body: Record<string, unknown>) {
  await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    method: "POST",
  });
}

export function SessionTelemetryBridge() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const descriptor = inferActivityDescriptor(pathname);

    if (!descriptor) {
      return;
    }

    if (shouldThrottle("cn-exeflow-activity", descriptor.pagePath, ACTIVITY_THROTTLE_MS)) {
      return;
    }

    void postJson("/api/activity/track", {
      activityType: descriptor.activityType,
      pagePath: descriptor.pagePath,
      targetId: descriptor.targetId ?? null,
      targetType: descriptor.targetType ?? null,
    });
  }, [pathname]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (shouldThrottle(DEVICE_SYNC_STORAGE_KEY, "global", DEVICE_SYNC_THROTTLE_MS)) {
      return;
    }

    const deviceKey = getOrCreateDeviceKey();
    const currentPermission =
      typeof Notification === "undefined" ? "unsupported" : Notification.permission;

    const syncDevice = async (permission: string) => {
      await postJson("/api/user/device", {
        deviceKey,
        deviceType: inferDeviceType(),
        notificationPermission: permission,
        platform: inferPlatform(),
        pushToken: window.localStorage.getItem("cn-exeflow-push-token"),
      });
    };

    if (
      typeof Notification !== "undefined" &&
      currentPermission === "default" &&
      !window.localStorage.getItem(NOTIFICATION_PROMPT_STORAGE_KEY)
    ) {
      window.localStorage.setItem(NOTIFICATION_PROMPT_STORAGE_KEY, "requested");

      void Notification.requestPermission()
        .then((permission) => syncDevice(permission))
        .catch(() => syncDevice("default"));

      return;
    }

    void syncDevice(currentPermission);
  }, [pathname]);

  return null;
}
