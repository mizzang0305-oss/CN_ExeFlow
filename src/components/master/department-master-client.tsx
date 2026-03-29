"use client";

import { useMemo, useState } from "react";

import { readApiResponse } from "@/lib/api";
import type { MasterDepartmentItem, MasterUserItem } from "@/features/master/types";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldGroup, FieldLabel, Input, Select } from "@/components/ui/field";

type DepartmentFormState = {
  code: string;
  headUserId: string;
  isActive: boolean;
  name: string;
  sortOrder: number;
};

function toFormState(item?: MasterDepartmentItem): DepartmentFormState {
  return {
    code: item?.code ?? "",
    headUserId: item?.headUserId ?? "",
    isActive: item?.isActive ?? true,
    name: item?.name ?? "",
    sortOrder: item?.sortOrder ?? 0,
  };
}

export function DepartmentMasterClient({
  departments,
  users,
}: {
  departments: MasterDepartmentItem[];
  users: MasterUserItem[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DepartmentFormState>(() => toFormState());
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headOptions = useMemo(() => users.filter((user) => user.isActive), [users]);

  function resetForm() {
    setEditingId(null);
    setForm(toFormState());
    setError(null);
  }

  function startEdit(item: MasterDepartmentItem) {
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
        editingId ? `/api/admin/master/departments/${editingId}` : "/api/admin/master/departments",
        {
          body: JSON.stringify({
            code: form.code,
            headUserId: form.headUserId || null,
            isActive: form.isActive,
            name: form.name,
            sortOrder: form.sortOrder,
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
      setError(submitError instanceof Error ? submitError.message : "부서 저장 중 문제가 발생했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="space-y-2">
          <CardTitle>{editingId ? "부서 수정" : "부서 추가"}</CardTitle>
          <CardDescription>
            부서 코드, 표시명, 부서장, 활성 상태를 바로 관리합니다.
          </CardDescription>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <FieldGroup>
            <FieldLabel label="부서 코드" required />
            <Input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="SALES"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="부서명" required />
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="영업본부"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="정렬 순서" required />
            <Input
              type="number"
              value={String(form.sortOrder)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sortOrder: Number.parseInt(event.target.value || "0", 10),
                }))
              }
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="부서장 지정" />
            <Select
              value={form.headUserId}
              onChange={(event) => setForm((current) => ({ ...current, headUserId: event.target.value }))}
            >
              <option value="">미지정</option>
              {headOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} · {user.departmentName ?? "미배정"}
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
              활성 부서로 유지
            </label>
          </div>

          {error ? (
            <div className="md:col-span-2 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button
              type="submit"
              size="md"
              isLoading={isPending}
              loadingLabel={editingId ? "부서 저장 중" : "부서 추가 중"}
            >
              {editingId ? "부서 수정" : "부서 추가"}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" size="md" onClick={resetForm} disabled={isPending}>
                편집 취소
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {departments.length === 0 ? (
        <EmptyState
          title="등록된 부서가 없습니다"
          description="첫 부서를 추가하면 로그인과 권한 배정의 기준이 바로 생깁니다."
        />
      ) : (
        <div className="grid gap-4">
          {departments.map((department) => (
            <Card key={department.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-ink-500">{department.code}</p>
                  <h3 className="mt-1 text-lg font-semibold text-ink-950">{department.name}</h3>
                  <p className="mt-2 text-sm text-ink-700">
                    사용자 {department.activeUserCount}명
                    {department.headUserName ? ` · 부서장 ${department.headUserName}` : " · 부서장 미지정"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={
                      department.isActive
                        ? "rounded-full bg-success-100 px-3 py-1 text-xs font-semibold text-success-700"
                        : "rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600"
                    }
                  >
                    {department.isActive ? "활성" : "비활성"}
                  </span>
                  <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(department)}>
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
