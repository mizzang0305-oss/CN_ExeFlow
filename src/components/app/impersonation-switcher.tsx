"use client";

import { useEffect, useState } from "react";

import type { AppSession, UserRole } from "@/features/auth/types";
import { isAdminRole } from "@/features/auth/utils";
import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";

type ImpersonationUser = {
  departmentName: string | null;
  displayName: string;
  email: string | null;
  id: string;
  role: UserRole;
  title: string | null;
};

type ImpersonationUsersResponse = {
  users: ImpersonationUser[];
};

export function ImpersonationSwitcher({ session }: { session: AppSession }) {
  const [users, setUsers] = useState<ImpersonationUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const canSwitchUser = isAdminRole(session.role) && !session.impersonation;

  useEffect(() => {
    if (!canSwitchUser) {
      return;
    }

    let isMounted = true;

    fetch("/api/admin/impersonation", {
      headers: { Accept: "application/json" },
    })
      .then((response) => readApiResponse<ImpersonationUsersResponse>(response))
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const nextUsers = data.users.filter((user) => user.id !== session.userId);
        setUsers(nextUsers);
        setSelectedUserId(nextUsers[0]?.id ?? "");
      })
      .catch(() => {
        if (isMounted) {
          setUsers([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canSwitchUser, session.userId]);

  async function startSwitch() {
    if (!selectedUserId) {
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/admin/impersonation", {
        body: JSON.stringify({ userId: selectedUserId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await readApiResponse<{ redirectTo: string }>(response);
      window.location.href = data.redirectTo;
    } finally {
      setIsPending(false);
    }
  }

  async function stopSwitch() {
    setIsPending(true);

    try {
      const response = await fetch("/api/admin/impersonation", {
        method: "DELETE",
      });
      const data = await readApiResponse<{ redirectTo: string }>(response);
      window.location.href = data.redirectTo;
    } finally {
      setIsPending(false);
    }
  }

  if (session.impersonation) {
    return (
      <div className="rounded-[24px] border border-warning-200 bg-warning-50 px-4 py-3 text-ink-950">
        <p className="text-sm font-bold">대리 확인 중: {session.impersonation.impersonatedDisplayName}</p>
        <p className="mt-1 text-xs font-semibold text-ink-700">실제 로그인 계정: {session.impersonation.actorDisplayName}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          isLoading={isPending}
          loadingLabel="돌아가는 중"
          onClick={() => void stopSwitch()}
        >
          슈퍼관리자로 돌아가기
        </Button>
      </div>
    );
  }

  if (!canSwitchUser) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-[24px] border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-xl sm:max-w-[26rem]">
      <label className="text-xs font-bold text-white/72" htmlFor="impersonation-user-select">
        사용자 화면 전환
      </label>
      <div className="flex gap-2">
        <select
          id="impersonation-user-select"
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          className="min-h-10 flex-1 rounded-[16px] border border-white/16 bg-white/90 px-3 text-sm font-bold text-ink-950"
          aria-label="전환할 사용자 선택"
        >
          {users.length === 0 ? <option value="">사용자 없음</option> : null}
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName} {user.title ?? ""} {user.departmentName ? `· ${user.departmentName}` : ""}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!selectedUserId}
          isLoading={isPending}
          loadingLabel="전환 중"
          onClick={() => void startSwitch()}
        >
          전환
        </Button>
      </div>
    </div>
  );
}
