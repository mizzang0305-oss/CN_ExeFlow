"use client";

import { useState } from "react";

import type { MasterDepartmentItem, MasterUserItem, UserUpsertInput } from "@/features/master/types";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { FieldGroup, FieldLabel, Input, Select } from "../ui/field";

const roleOptions = [
  "CEO",
  "SUPER_ADMIN",
  "DEPARTMENT_HEAD",
  "STAFF",
  "VIEWER",
] as const;

type UserEditorProps = {
  defaultDepartmentId: string | null;
  departments: MasterDepartmentItem[];
  initialUser: MasterUserItem | null;
  onCancel: () => void;
  onSave: (input: UserUpsertInput) => Promise<void> | void;
  pending: boolean;
};

type UserFormState = {
  departmentId: string;
  email: string;
  isActive: boolean;
  name: string;
  profileName: string;
  role: (typeof roleOptions)[number];
  title: string;
};

function buildFormState(user: MasterUserItem | null, defaultDepartmentId: string | null): UserFormState {
  return {
    departmentId: user?.departmentId ?? defaultDepartmentId ?? "",
    email: user?.email ?? "",
    isActive: user?.isActive ?? true,
    name: user?.name ?? "",
    profileName: user?.profileName ?? "",
    role: user?.role ?? "STAFF",
    title: user?.title ?? "",
  };
}

export function UserEditor({
  defaultDepartmentId,
  departments,
  initialUser,
  onCancel,
  onSave,
  pending,
}: UserEditorProps) {
  const [form, setForm] = useState<UserFormState>(() => buildFormState(initialUser, defaultDepartmentId));

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-lg font-semibold tracking-tight text-ink-950">
          {initialUser ? "사용자 수정" : "사용자 추가"}
        </p>
        <p className="text-sm leading-6 text-ink-700">
          역할, 부서, 활성 상태를 바로 조정할 수 있습니다. 모바일에서는 부서 변경을 이 폼에서 처리할 수 있습니다.
        </p>
      </div>

      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            departmentId: form.departmentId || null,
            email: form.email,
            isActive: form.isActive,
            name: form.name,
            profileName: form.profileName || null,
            role: form.role,
            title: form.title || null,
          });
        }}
      >
        <FieldGroup>
          <FieldLabel label="이름" required />
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="홍길동"
          />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel label="표시명" />
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
          <FieldLabel label="직책" />
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
                role: event.target.value as UserFormState["role"],
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
          <FieldLabel label="소속 부서" />
          <Select
            value={form.departmentId}
            onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}
          >
            <option value="">미배정</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.fullPath}
              </option>
            ))}
          </Select>
        </FieldGroup>

        <div className="md:col-span-2 flex items-center gap-3 rounded-[22px] bg-surface px-4 py-4">
          <label className="inline-flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border border-ink-300 text-brand-700"
            />
            활성 사용자로 유지
          </label>
          {!form.isActive ? <span className="text-sm text-ink-500">비활성 시 soft delete처럼 목록에서 분리됩니다.</span> : null}
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" size="md" disabled={pending}>
            {pending ? "저장 중..." : initialUser ? "사용자 저장" : "사용자 생성"}
          </Button>
          <Button type="button" size="md" variant="ghost" onClick={onCancel} disabled={pending}>
            취소
          </Button>
        </div>
      </form>
    </Card>
  );
}
