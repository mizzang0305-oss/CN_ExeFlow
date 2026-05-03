"use client";

import { useEffect, useMemo, useState } from "react";

import type { AppSession, UserRole } from "@/features/auth/types";
import { isAdminRole } from "@/features/auth/utils";
import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";

export type ImpersonationState = {
  active: boolean;
  userId: string | null;
  userName: string | null;
};

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

type ImpersonationAuditAction = "IMPERSONATION_STARTED" | "IMPERSONATION_ENDED";

const IMPERSONATION_STORAGE_KEY = "cn.impersonation";
const IMPERSONATION_CHANGED_EVENT = "cn.impersonation.changed";
export const ENABLE_IMPERSONATION_SWITCHER = process.env.NEXT_PUBLIC_ENABLE_IMPERSONATION === "true";
const EMPTY_IMPERSONATION: ImpersonationState = {
  active: false,
  userId: null,
  userName: null,
};

function readImpersonationState(): ImpersonationState {
  if (typeof window === "undefined") {
    return EMPTY_IMPERSONATION;
  }

  try {
    const rawValue = window.localStorage.getItem(IMPERSONATION_STORAGE_KEY);

    if (!rawValue) {
      return EMPTY_IMPERSONATION;
    }

    const parsed = JSON.parse(rawValue) as Partial<ImpersonationState>;

    if (parsed.active !== true || typeof parsed.userId !== "string" || typeof parsed.userName !== "string") {
      return EMPTY_IMPERSONATION;
    }

    return {
      active: true,
      userId: parsed.userId,
      userName: parsed.userName,
    };
  } catch {
    return EMPTY_IMPERSONATION;
  }
}

function notifyImpersonationChanged() {
  window.dispatchEvent(new CustomEvent(IMPERSONATION_CHANGED_EVENT));
}

function storeImpersonationState(state: ImpersonationState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(state));
  notifyImpersonationChanged();
}

function clearImpersonationState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  notifyImpersonationChanged();
}

async function recordImpersonationAudit(action: ImpersonationAuditAction, state: ImpersonationState) {
  if (!state.userId) {
    return;
  }

  const response = await fetch("/api/admin/impersonation/audit", {
    body: JSON.stringify({
      action,
      impersonatedUserId: state.userId,
      impersonatedUserName: state.userName,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  await readApiResponse<{ recorded: boolean }>(response);
}

export function useStoredImpersonationState() {
  const [state, setState] = useState<ImpersonationState>(EMPTY_IMPERSONATION);

  useEffect(() => {
    function syncState() {
      setState(readImpersonationState());
    }

    syncState();
    window.addEventListener("storage", syncState);
    window.addEventListener(IMPERSONATION_CHANGED_EVENT, syncState);

    return () => {
      window.removeEventListener("storage", syncState);
      window.removeEventListener(IMPERSONATION_CHANGED_EVENT, syncState);
    };
  }, []);

  return state;
}

export function ImpersonationSwitcher({ session }: { session: AppSession }) {
  const [users, setUsers] = useState<ImpersonationUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const impersonation = useStoredImpersonationState();
  const canSwitchUser = ENABLE_IMPERSONATION_SWITCHER && Boolean(session?.userId) && isAdminRole(session.role);
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  useEffect(() => {
    if (!canSwitchUser) {
      clearImpersonationState();
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
      })
      .finally(() => {
        if (isMounted) {
          setIsPending(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canSwitchUser, session.userId]);

  async function startSwitch() {
    if (!selectedUser) {
      return;
    }

    const nextState = {
      active: true,
      userId: selectedUser.id,
      userName: selectedUser.displayName,
    } satisfies ImpersonationState;

    setIsPending(true);

    try {
      await recordImpersonationAudit("IMPERSONATION_STARTED", nextState);
      storeImpersonationState(nextState);
    } finally {
      setIsPending(false);
    }
  }

  async function stopSwitch() {
    setIsPending(true);

    try {
      await recordImpersonationAudit("IMPERSONATION_ENDED", impersonation);
    } finally {
      clearImpersonationState();
      window.location.reload();
    }
  }

  if (!ENABLE_IMPERSONATION_SWITCHER) {
    return null;
  }

  if (!canSwitchUser) {
    return null;
  }

  if (impersonation.active) {
    return (
      <div className="rounded-[24px] border border-warning-200 bg-warning-50 px-4 py-3 text-ink-950">
        <p className="text-sm font-bold">대리 확인 중: {impersonation.userName}</p>
        <p className="mt-1 text-xs font-semibold text-ink-700">실제 로그인 계정: {session.displayName}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          isLoading={isPending}
          loadingLabel="확인 중"
          onClick={() => void stopSwitch()}
        >
          슈퍼관리자로 돌아가기
        </Button>
      </div>
    );
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
          disabled={!selectedUserId || isPending}
          isLoading={isPending}
          loadingLabel="확인 중"
          onClick={() => void startSwitch()}
        >
          전환
        </Button>
      </div>
    </div>
  );
}
