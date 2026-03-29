"use client";

import { roleLabelMap } from "@/features/auth/utils";
import type { MasterUserItem } from "@/features/master/types";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/empty-state";

type UserListProps = {
  isPending: boolean;
  onDragEnd: () => void;
  onDragStartUser: (userId: string) => void;
  onEditUser: (userId: string) => void;
  onStartCreateUser: () => void;
  onToggleUserActive: (userId: string) => void;
  users: MasterUserItem[];
};

export function UserList({
  isPending,
  onDragEnd,
  onDragStartUser,
  onEditUser,
  onStartCreateUser,
  onToggleUserActive,
  users,
}: UserListProps) {
  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight text-ink-950">사용자 목록</p>
          <p className="mt-1 text-sm leading-6 text-ink-700">
            데스크톱에서는 사용자 카드를 다른 부서로 드래그할 수 있고, 모바일에서는 편집 폼에서 부서를 변경할 수 있습니다.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onStartCreateUser} disabled={isPending}>
          사용자 추가
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="이 부서에 사용자가 없습니다"
          description="첫 사용자를 추가하거나 다른 부서의 사용자를 여기로 드래그해서 배정할 수 있습니다."
        />
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              draggable={!isPending}
              onDragEnd={onDragEnd}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                onDragStartUser(user.id);
              }}
              className="rounded-[24px] border border-ink-200 bg-white px-5 py-5 transition hover:border-brand-100 hover:bg-brand-50/30"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold tracking-tight text-ink-950">{user.displayName}</p>
                    <Badge tone={user.isActive ? "success" : "muted"}>{user.isActive ? "활성" : "비활성"}</Badge>
                    <Badge tone="default">{roleLabelMap[user.role]}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-ink-700">
                    <p>{user.departmentName ?? "미배정"}</p>
                    <p className="text-ink-500">
                      {user.email ?? "이메일 없음"}
                      {user.title ? ` · ${user.title}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => onEditUser(user.id)} disabled={isPending}>
                    수정
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleUserActive(user.id)}
                    disabled={isPending}
                  >
                    {user.isActive ? "비활성화" : "재활성화"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
