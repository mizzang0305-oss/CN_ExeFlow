"use client";

import { useMemo, useState } from "react";

import type { DepartmentUpsertInput, OrgTreeData, UserUpsertInput } from "@/features/master/types";
import { readApiResponse } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { OrgPanel } from "./org-panel";
import { OrgTree } from "./org-tree";

type DragItem = {
  id: string;
  type: "department" | "user";
} | null;

type DepartmentEditorMode =
  | {
      type: "create-child";
    }
  | {
      type: "create-root";
    }
  | {
      type: "edit";
    };

type UserEditorMode =
  | {
      type: "create";
    }
  | {
      type: "edit";
      userId: string;
    }
  | null;

function resolveSelection(snapshot: OrgTreeData, currentDepartmentId: string | null) {
  if (currentDepartmentId && snapshot.departments.some((department) => department.id === currentDepartmentId)) {
    return currentDepartmentId;
  }

  return snapshot.tree[0]?.id ?? snapshot.departments[0]?.id ?? null;
}

function buildExpandedIds(
  snapshot: OrgTreeData,
  selectedDepartmentId: string | null,
  previousExpandedIds?: Set<string>,
) {
  const departmentMap = new Map(snapshot.departments.map((department) => [department.id, department]));
  const nextExpanded = new Set<string>();

  for (const root of snapshot.tree) {
    nextExpanded.add(root.id);
  }

  if (previousExpandedIds) {
    for (const id of previousExpandedIds) {
      if (departmentMap.has(id)) {
        nextExpanded.add(id);
      }
    }
  }

  let cursor = selectedDepartmentId ? departmentMap.get(selectedDepartmentId)?.parentId ?? null : null;

  while (cursor) {
    nextExpanded.add(cursor);
    cursor = departmentMap.get(cursor)?.parentId ?? null;
  }

  return nextExpanded;
}

function isDescendantDepartment(snapshot: OrgTreeData, sourceDepartmentId: string, targetDepartmentId: string) {
  const departmentMap = new Map(snapshot.departments.map((department) => [department.id, department]));
  let cursor = departmentMap.get(targetDepartmentId)?.parentId ?? null;

  while (cursor) {
    if (cursor === sourceDepartmentId) {
      return true;
    }

    cursor = departmentMap.get(cursor)?.parentId ?? null;
  }

  return false;
}

export function OrgAdminClient({ initialData }: { initialData: OrgTreeData }) {
  const initialSelectedDepartmentId = resolveSelection(initialData, initialData.tree[0]?.id ?? null);
  const [snapshot, setSnapshot] = useState<OrgTreeData>(initialData);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(initialSelectedDepartmentId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => buildExpandedIds(initialData, initialSelectedDepartmentId),
  );
  const [departmentMode, setDepartmentMode] = useState<DepartmentEditorMode>(
    initialSelectedDepartmentId ? { type: "edit" } : { type: "create-root" },
  );
  const [userMode, setUserMode] = useState<UserEditorMode>(null);
  const [dragItem, setDragItem] = useState<DragItem>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDepartment = useMemo(
    () => snapshot.departments.find((department) => department.id === selectedDepartmentId) ?? null,
    [selectedDepartmentId, snapshot.departments],
  );
  const usersById = useMemo(() => new Map(snapshot.users.map((user) => [user.id, user])), [snapshot.users]);
  const summary = useMemo(
    () => ({
      activeUsers: snapshot.users.filter((user) => user.isActive).length,
      inactiveUsers: snapshot.users.filter((user) => !user.isActive).length,
      rootDepartments: snapshot.departments.filter((department) => !department.parentId).length,
      totalDepartments: snapshot.departments.length,
    }),
    [snapshot.departments, snapshot.users],
  );

  function syncSnapshot(nextSnapshot: OrgTreeData, nextSelectedDepartmentId?: string | null) {
    const resolvedSelection = resolveSelection(nextSnapshot, nextSelectedDepartmentId ?? selectedDepartmentId);

    setSnapshot(nextSnapshot);
    setSelectedDepartmentId(resolvedSelection);
    setExpandedIds((current) => buildExpandedIds(nextSnapshot, resolvedSelection, current));
    setDepartmentMode(resolvedSelection ? { type: "edit" } : { type: "create-root" });
  }

  async function applySnapshotRequest(
    input: RequestInfo,
    init?: RequestInit,
    nextSelected?: string | null,
  ) {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(input, {
        ...init,
        cache: "no-store",
      });
      const data = await readApiResponse<OrgTreeData>(response);
      syncSnapshot(data, nextSelected);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "조직 정보를 저장하지 못했습니다.");
      throw requestError;
    } finally {
      setIsPending(false);
      setDragItem(null);
    }
  }

  function canDropOnDepartment(targetDepartmentId: string | null) {
    if (!dragItem) {
      return false;
    }

    if (dragItem.type === "department") {
      if (dragItem.id === targetDepartmentId) {
        return false;
      }

      if (!targetDepartmentId) {
        return true;
      }

      return !isDescendantDepartment(snapshot, dragItem.id, targetDepartmentId);
    }

    const draggedUser = usersById.get(dragItem.id);

    if (!draggedUser || !targetDepartmentId) {
      return false;
    }

    return draggedUser.departmentId !== targetDepartmentId;
  }

  async function handleDepartmentDrop(targetDepartmentId: string | null) {
    if (!dragItem) {
      return;
    }

    if (dragItem.type === "department") {
      if (!canDropOnDepartment(targetDepartmentId)) {
        setDragItem(null);
        return;
      }

      try {
        await applySnapshotRequest(
          "/api/admin/org/department/reorder",
          {
            body: JSON.stringify({
              departmentId: dragItem.id,
              parentId: targetDepartmentId,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "PATCH",
          },
          dragItem.id,
        );
      } catch {}
      return;
    }

    if (!targetDepartmentId || !canDropOnDepartment(targetDepartmentId)) {
      setDragItem(null);
      return;
    }

    try {
      await applySnapshotRequest(
        "/api/admin/org/user/move",
        {
          body: JSON.stringify({
            departmentId: targetDepartmentId,
            userId: dragItem.id,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
        targetDepartmentId,
      );
    } catch {}
  }

  async function handleDepartmentSave(input: DepartmentUpsertInput) {
    try {
      await applySnapshotRequest(
        departmentMode.type === "edit" && selectedDepartment
          ? `/api/admin/org/department/${selectedDepartment.id}`
          : "/api/admin/org/department",
        {
          body: JSON.stringify(input),
          headers: {
            "Content-Type": "application/json",
          },
          method: departmentMode.type === "edit" ? "PATCH" : "POST",
        },
        selectedDepartment?.id ?? null,
      );
    } catch {}
  }

  async function handleDepartmentMove(parentId: string | null) {
    if (!selectedDepartment) {
      return;
    }

    try {
      await applySnapshotRequest(
        "/api/admin/org/department/reorder",
        {
          body: JSON.stringify({
            departmentId: selectedDepartment.id,
            parentId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
        selectedDepartment.id,
      );
    } catch {}
  }

  async function handleUserSave(input: UserUpsertInput) {
    try {
      await applySnapshotRequest(
        userMode?.type === "edit" ? `/api/admin/org/user/${userMode.userId}` : "/api/admin/org/user",
        {
          body: JSON.stringify(input),
          headers: {
            "Content-Type": "application/json",
          },
          method: userMode?.type === "edit" ? "PATCH" : "POST",
        },
        input.departmentId ?? selectedDepartmentId,
      );
      setUserMode(null);
    } catch {}
  }

  async function handleToggleUserActive(userId: string) {
    const user = usersById.get(userId);

    if (!user) {
      return;
    }

    if (!user.email) {
      setError("이메일 정보가 없는 사용자는 이 화면에서 상태를 변경할 수 없습니다.");
      return;
    }

    try {
      await applySnapshotRequest(
        `/api/admin/org/user/${user.id}`,
        {
          body: JSON.stringify({
            departmentId: user.departmentId,
            email: user.email,
            isActive: !user.isActive,
            name: user.name,
            profileName: user.profileName,
            role: user.role,
            title: user.title,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
        user.departmentId ?? selectedDepartmentId,
      );
    } catch {}
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            description: "계층과 사용자 기준이 되는 전체 조직 수",
            label: "전체 조직",
            value: summary.totalDepartments,
          },
          {
            description: "루트 레벨에서 관리되는 상위 조직 수",
            label: "최상위 조직",
            value: summary.rootDepartments,
          },
          {
            description: "현재 로그인 가능한 활성 사용자 수",
            label: "활성 사용자",
            value: summary.activeUsers,
          },
          {
            description: "soft delete 상태로 남아 있는 비활성 사용자 수",
            label: "비활성 사용자",
            value: summary.inactiveUsers,
          },
        ].map((item) => (
          <Card key={item.label} className="space-y-3">
            <p className="text-sm font-semibold text-ink-700">{item.label}</p>
            <p className="text-3xl font-semibold tracking-tight text-ink-950">{item.value}</p>
            <p className="text-sm leading-6 text-ink-700">{item.description}</p>
          </Card>
        ))}
      </section>

      {error ? (
        <div className="rounded-[24px] border border-danger-100 bg-danger-50 px-5 py-4 text-sm text-danger-700">
          {error}
        </div>
      ) : null}

      {selectedDepartment ? (
        <Card className="space-y-4 border-brand-100 bg-[linear-gradient(180deg,rgba(232,240,255,0.7),rgba(255,255,255,1))]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-semibold tracking-tight text-ink-950">{selectedDepartment.name}</p>
                <Badge tone="default">{selectedDepartment.code}</Badge>
                {!selectedDepartment.isActive ? <Badge tone="muted">비활성</Badge> : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-700">
                {selectedDepartment.fullPath}
                {" · "}
                {selectedDepartment.headUserName ? `부서장 ${selectedDepartment.headUserName}` : "부서장 미지정"}
              </p>
            </div>
            <div className="grid gap-2 text-sm text-ink-700 sm:grid-cols-3">
              <span>{`직속 사용자 ${selectedDepartment.activeUserCount}`}</span>
              <span>{`하위 조직 ${selectedDepartment.childCount}`}</span>
              <span>{`정렬 ${selectedDepartment.sortOrder}`}</span>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <OrgTree
            canDropOnDepartment={canDropOnDepartment}
            dragItem={dragItem}
            expandedIds={expandedIds}
            isPending={isPending}
            onDepartmentDrop={handleDepartmentDrop}
            onDragEnd={() => setDragItem(null)}
            onDragStartDepartment={(departmentId) => setDragItem({ id: departmentId, type: "department" })}
            onSelect={(departmentId) => {
              setSelectedDepartmentId(departmentId);
              setExpandedIds((current) => {
                const next = new Set(current);
                next.add(departmentId);
                return buildExpandedIds(snapshot, departmentId, next);
              });
              setDepartmentMode({ type: "edit" });
              setUserMode(null);
            }}
            onStartCreateRoot={() => {
              setDepartmentMode({ type: "create-root" });
              setUserMode(null);
            }}
            onToggle={(departmentId) => {
              setExpandedIds((current) => {
                const next = new Set(current);

                if (next.has(departmentId)) {
                  next.delete(departmentId);
                } else {
                  next.add(departmentId);
                }

                return next;
              });
            }}
            selectedDepartmentId={selectedDepartmentId}
            snapshot={snapshot}
          />
        </div>

        <OrgPanel
          departmentMode={departmentMode}
          departments={snapshot.departments}
          isPending={isPending}
          onCancelDepartmentCreate={() => setDepartmentMode(selectedDepartment ? { type: "edit" } : { type: "create-root" })}
          onCancelUserEditor={() => setUserMode(null)}
          onDepartmentMove={handleDepartmentMove}
          onDepartmentSave={handleDepartmentSave}
          onDragEnd={() => setDragItem(null)}
          onDragStartUser={(userId) => setDragItem({ id: userId, type: "user" })}
          onSaveUser={handleUserSave}
          onStartCreateChild={() => {
            if (!selectedDepartment) {
              return;
            }

            setDepartmentMode({ type: "create-child" });
            setUserMode(null);
          }}
          onStartCreateRoot={() => {
            setDepartmentMode({ type: "create-root" });
            setUserMode(null);
          }}
          onStartCreateUser={() => setUserMode({ type: "create" })}
          onToggleUserActive={handleToggleUserActive}
          onUserEdit={(userId) => setUserMode({ type: "edit", userId })}
          selectedDepartment={selectedDepartment}
          userMode={userMode}
          users={snapshot.users}
        />
      </section>
    </div>
  );
}
