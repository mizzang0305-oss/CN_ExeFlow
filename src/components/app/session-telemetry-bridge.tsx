"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import type { UserActivityType } from "@/features/activity/types";

import { readDeviceRegistrationPayload } from "./device-client";

const ACTIVITY_THROTTLE_MS = 45 * 1000;
const DEVICE_SYNC_THROTTLE_MS = 15 * 60 * 1000;

function postJson(url: string, body: object) {
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
  if (pathname === "/dashboard/ceo") {
    return {
      activityType: "CEO_DASHBOARD_VIEW",
      pagePath: pathname,
    };
  }

  if (pathname === "/board") {
    return {
      activityType: "DEPARTMENT_BOARD_VIEW",
      pagePath: pathname,
    };
  }

  if (pathname === "/workspace") {
    return {
      activityType: "STAFF_HOME_VIEW",
      pagePath: pathname,
    };
  }

  if (pathname === "/viewer") {
    return {
      activityType: "VIEWER_HOME_VIEW",
      pagePath: pathname,
    };
  }

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

  if (pathname === "/notifications") {
    return {
      activityType: "NOTIFICATION_INBOX_VIEW",
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

function shouldThrottle(key: string, minIntervalMs: number) {
  const now = Date.now();
  const lastSentAt = Number(window.localStorage.getItem(key) ?? "0");

  if (now - lastSentAt < minIntervalMs) {
    return true;
  }

  window.localStorage.setItem(key, String(now));
  return false;
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

    void postJson("/api/activity/track", activity);
  }, [pathname]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const deviceRegistration = readDeviceRegistrationPayload();
    const throttleKey = `cn-exeflow-device-sync:${deviceRegistration.deviceKey}`;

    if (shouldThrottle(throttleKey, DEVICE_SYNC_THROTTLE_MS)) {
      return;
    }

    void postJson("/api/user/device", deviceRegistration);
  }, [pathname]);

  return null;
}
