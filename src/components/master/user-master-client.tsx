"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/api";
import type { UserRole } from "@/features/auth/types";
import type { MasterDepartmentItem, MasterUserItem } from "@/features/master/types";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldGroup, FieldLabel, Input, Select } from "@/components/ui/field";

const roleOptions: UserRole[] = ["CEO", "SUPER_ADMIN", "DEPARTMENT_HEAD", "STAFF", "VIEWER"];

type UserFormState = {
  departmentId: string;
  email: string;
  isActive: boolean;
  name: string;
  profileName: string;
  role: UserRole;
  title: string;
};

function toFormState(item?: MasterUserItem): UserFormState {
  return {
    departmentId: item?.departmentId ?? "",
    email: item?.email ?? "",
    isActive: item?.isActive ?? true,
    name: item?.name ?? "",
    profileName: item?.profileName ?? "",
    role: item?.role ?? "STAFF",
    title: item?.title ?? "",
  };
}

export function UserMasterClient({
  departments,
  users,
}: {
  departments: MasterDepartmentItem[];
  users: MasterUserItem[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(() => toFormState());
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setForm(toFormState());
    setError(null);
  }

  function startEdit(item: MasterUserItem) {
    setEditingId(item.id);
    setForm(toFormState(item));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(
        editingId ? `/api/admin/master/users/${editingId}` : "/api/admin/master/users",
        {
          body: JSON.stringify({
            departmentId: form.departmentId || null,
            email: form.email,
            isActive: form.isActive,
            name: form.name,
            profileName: form.profileName || null,
            role: form.role,
            title: form.title || null,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: editingId ? "PATCH" : "POST",
        },
      );

      await readApiResponse(response);
      resetForm();
      window.location.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "사용자 저장 중 문제가 발생했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="space-y-2">
          <CardTitle>{editingId ? "사용자 수정" : "사용자 추가"}</CardTitle>
          <CardDescription>
            로그인 표시명, 부서 배정, 역할, 활성 상태를 한 화면에서 관리합니다.
          </CardDescription>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <FieldGroup>
            <FieldLabel label="이름" required />
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="홍길동"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="표시명(profile_name)" />
            <Input
              value={form.profileName}
              onChange={(event) => setForm((current) => ({ ...current, profileName: event.target.value }))}
              placeholder="홍길동 팀장"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="이메일" required />
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="name@cnfood.co.kr"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="직책(title)" />
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="전략기획팀장"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="역할" required />
            <Select
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value as UserRole,
                }))
              }
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="부서 배정" />
            <Select
              value={form.departmentId}
              onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}
            >
              <option value="">미배정</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <div className="md:col-span-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-4 w-4 rounded border border-ink-300 text-brand-700"
              />
              활성 사용자로 유지
            </label>
          </div>

          {error ? (
            <div className="md:col-span-2 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" size="md" disabled={isPending}>
              {isPending ? "저장 중..." : editingId ? "사용자 수정" : "사용자 추가"}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" size="md" onClick={resetForm} disabled={isPending}>
                편집 취소
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {users.length === 0 ? (
        <EmptyState
          title="등록된 사용자가 없습니다"
          description="로그인과 권한 테스트를 위해 첫 사용자를 추가해 주세요."
        />
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-950">{user.displayName}</p>
                  <p className="mt-1 text-sm text-ink-700">
                    {user.departmentName ?? "미배정"} · {user.role}
                  </p>
                  <p className="mt-2 text-xs text-ink-500">
                    {user.email ?? "이메일 없음"}
                    {user.title ? ` · ${user.title}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={
                      user.isActive
                        ? "rounded-full bg-success-100 px-3 py-1 text-xs font-semibold text-success-700"
                        : "rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600"
                    }
                  >
                    {user.isActive ? "활성" : "비활성"}
                  </span>
                  <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(user)}>
                    수정
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
