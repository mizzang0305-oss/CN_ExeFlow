"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type NotificationSummaryResponse = {
  unreadCount: number;
};

async function fetchNotificationSummary() {
  const response = await fetch("/api/notifications?page=1&pageSize=1", {
    cache: "no-store",
    credentials: "include",
  });

  const payload = (await response.json()) as {
    data?: NotificationSummaryResponse;
    ok?: boolean;
  };

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error("notification-summary-failed");
  }

  return payload.data;
}

export function NotificationInboxLink({ currentPath }: { currentPath: string }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    void fetchNotificationSummary()
      .then((data) => {
        if (isMounted) {
          setUnreadCount(data.unreadCount);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUnreadCount(0);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      void fetchNotificationSummary()
        .then((data) => {
          setUnreadCount(data.unreadCount);
        })
        .catch(() => {
          setUnreadCount(0);
        });
    };

    window.addEventListener("cn-exeflow:notifications-updated", handleRefresh);
    window.addEventListener("focus", handleRefresh);

    return () => {
      window.removeEventListener("cn-exeflow:notifications-updated", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, []);

  const isActive = currentPath === "/notifications";

  return (
    <Link
      href="/notifications"
      className={cn(
        "relative inline-flex h-11 min-w-11 items-center justify-center rounded-[20px] border px-3 text-sm font-semibold transition",
        isActive
          ? "border-white/20 bg-white/16 text-white"
          : "border-white/12 bg-white/8 text-white hover:bg-white/14",
      )}
      aria-label={unreadCount > 0 ? `알림함, 읽지 않은 알림 ${unreadCount}건` : "알림함"}
    >
      <span>알림</span>
      {unreadCount > 0 ? (
        <span className="absolute -right-2 -top-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-danger-500 px-1.5 text-[11px] font-bold text-white shadow-[0_10px_18px_rgba(220,38,38,0.28)]">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
