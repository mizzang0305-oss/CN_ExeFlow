"use client";

import type { DeviceRegistrationPayload, NotificationPermissionState } from "@/features/notifications/types";

export const DEVICE_KEY_STORAGE = "cn-exeflow-device-key";
export const PUSH_TOKEN_STORAGE = "cn-exeflow-push-token";
export const NOTIFICATION_BANNER_DISMISSED_STORAGE = "cn-exeflow-notification-banner-dismissed";

export function getClientDeviceKey() {
  const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE);

  if (existing) {
    return existing;
  }

  const generated = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_KEY_STORAGE, generated);
  return generated;
}

export function getStoredPushToken() {
  return window.localStorage.getItem(PUSH_TOKEN_STORAGE);
}

export function setStoredPushToken(pushToken: string | null) {
  if (!pushToken) {
    window.localStorage.removeItem(PUSH_TOKEN_STORAGE);
    return;
  }

  window.localStorage.setItem(PUSH_TOKEN_STORAGE, pushToken);
}

export function readNotificationPermission(): NotificationPermissionState {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission as NotificationPermissionState;
}

export function resolveDeviceType() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("ipad") || userAgent.includes("tablet")) {
    return "태블릿";
  }

  if (userAgent.includes("mobi") || userAgent.includes("iphone") || userAgent.includes("android")) {
    return "모바일";
  }

  return "데스크톱";
}

export function resolvePlatform() {
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

  return "기타";
}

export function resolveBrowserName() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("edg/")) {
    return "Edge";
  }

  if (userAgent.includes("chrome/")) {
    return "Chrome";
  }

  if (userAgent.includes("safari/") && !userAgent.includes("chrome/")) {
    return "Safari";
  }

  if (userAgent.includes("firefox/")) {
    return "Firefox";
  }

  return "브라우저";
}

export function resolveAppVersion() {
  return process.env.NEXT_PUBLIC_APP_VERSION ?? "web";
}

export function readDeviceRegistrationPayload(): DeviceRegistrationPayload {
  return {
    appVersion: resolveAppVersion(),
    browserName: resolveBrowserName(),
    deviceKey: getClientDeviceKey(),
    deviceType: resolveDeviceType(),
    isActive: true,
    notificationPermission: readNotificationPermission(),
    platform: resolvePlatform(),
    pushToken: getStoredPushToken(),
  };
}
