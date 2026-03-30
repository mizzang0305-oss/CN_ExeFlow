"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, EmptyState } from "@/components";
import { notificationChannelLabels, notificationTypeLabels } from "@/features/notifications/constants";
import type { NotificationInboxItem } from "@/features/notifications/types";
import { formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

type NotificationInboxClientProps = {
  initialItems: NotificationInboxItem[];
};

function postJson(url: string, body?: Record<string, unknown>) {
  return fetch(url, {
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    headers: body
      ? {
          "Content-Type": "application/json",
        }
      : undefined,
    method: "POST",
  });
}

export function NotificationInboxClient({ initialItems }: NotificationInboxClientProps) {
  const [items, setItems] = useState(initialItems);
  const unreadIds = useMemo(() => items.filter((item) => item.isUnread).map((item) => item.id), [items]);

  useEffect(() => {
    if (unreadIds.length === 0) {
      return;
    }

    const readAt = new Date().toISOString();

    void Promise.all(
      unreadIds.map(async (notificationId) => {
        await postJson(`/api/notifications/${notificationId}/read`);
      }),
    ).finally(() => {
      setItems((currentItems) =>
        currentItems.map((item) =>
          unreadIds.includes(item.id)
            ? {
                ...item,
                deliveryStatus: "READ",
                isUnread: false,
                readAt,
              }
            : item,
        ),
      );
      window.dispatchEvent(new Event("cn-exeflow:notifications-updated"));
    });
  }, [unreadIds]);

  async function handleMove(item: NotificationInboxItem) {
    const targetPath = item.targetPath ?? (item.directiveId ? `/directives/${item.directiveId}` : null);

    try {
      await postJson(`/api/notifications/${item.id}/click`, targetPath ? { targetPath } : undefined);

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                clickedAt: new Date().toISOString(),
                deliveryStatus: currentItem.readAt ? "READ" : "OPENED",
              }
            : currentItem,
        ),
      );
      window.dispatchEvent(new Event("cn-exeflow:notifications-updated"));
    } finally {
      if (targetPath) {
        window.location.assign(targetPath);
      }
    }

    if (!targetPath) {
      window.dispatchEvent(new Event("cn-exeflow:notifications-updated"));
    }
  }

  if (items.length === 0) {
    return <EmptyState title="새 알림이 없습니다." description="지시 배정, 완료 요청, 승인, 반려 알림이 여기에 표시됩니다." />;
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <Card key={item.id} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.isUnread ? "danger" : "default"}>{item.isUnread ? "읽지 않음" : "확인됨"}</Badge>
            <Badge tone="default">{notificationTypeLabels[item.notificationType]}</Badge>
            <Badge tone="muted">{notificationChannelLabels[item.channel]}</Badge>
            {item.directiveNo ? <Badge tone="muted">{item.directiveNo}</Badge> : null}
          </div>

          <div className="space-y-2">
            <p className="text-base font-semibold text-ink-950">{item.title}</p>
            <p className="text-sm leading-6 text-ink-700">{item.body}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">생성 시간</p>
              <p className="mt-2 text-sm font-semibold text-ink-950">{formatDateTimeLabel(item.sentAt)}</p>
              <p className="mt-1 text-xs text-ink-600">{formatRelativeUpdate(item.sentAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">읽음 시간</p>
              <p className="mt-2 text-sm text-ink-700">{item.readAt ? formatDateTimeLabel(item.readAt) : "미확인"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">클릭 시간</p>
              <p className="mt-2 text-sm text-ink-700">
                {item.clickedAt ? formatDateTimeLabel(item.clickedAt) : "이동 전"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">이동 화면</p>
              <p className="mt-2 text-sm text-ink-700">
                {item.targetPath ?? (item.directiveId ? `/directives/${item.directiveId}` : "연결된 화면 없음")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleMove(item)} disabled={!item.targetPath && !item.directiveId}>
              관련 화면 열기
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
