"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { MasterDepartmentItem, MasterUserItem } from "@/features/master/types";
import type { DirectiveTargetScope } from "@/features/directives/types";
import { readApiResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";

type DirectiveFormProps = {
  departments: MasterDepartmentItem[];
  users: MasterUserItem[];
};

export function DirectiveForm({ departments, users }: DirectiveFormProps) {
  const router = useRouter();
  const activeDepartments = useMemo(
    () => departments.filter((department) => department.isActive).sort((left, right) => left.name.localeCompare(right.name, "ko")),
    [departments],
  );
  const [targetScope, setTargetScope] = useState<DirectiveTargetScope>("SELECTED");
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    activeDepartments[0] ? [activeDepartments[0].id] : [],
  );
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState(activeDepartments[0]?.id ?? "");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSelectedDepartmentIds = useMemo(
    () =>
      targetScope === "ALL" ? activeDepartments.map((department) => department.id) : selectedDepartmentIds,
    [activeDepartments, selectedDepartmentIds, targetScope],
  );
  const selectedDepartments = useMemo(
    () =>
      activeDepartments.filter((department) => resolvedSelectedDepartmentIds.includes(department.id)),
    [activeDepartments, resolvedSelectedDepartmentIds],
  );
  const primaryDepartmentUsers = useMemo(
    () =>
      users.filter((user) => user.isActive && user.departmentId === primaryDepartmentId),
    [primaryDepartmentId, users],
  );

  useEffect(() => {
    if (!primaryDepartmentId && resolvedSelectedDepartmentIds[0]) {
      setPrimaryDepartmentId(resolvedSelectedDepartmentIds[0]);
      return;
    }

    if (primaryDepartmentId && !resolvedSelectedDepartmentIds.includes(primaryDepartmentId)) {
      setPrimaryDepartmentId(resolvedSelectedDepartmentIds[0] ?? "");
    }
  }, [primaryDepartmentId, resolvedSelectedDepartmentIds]);

  function toggleDepartment(departmentId: string) {
    setSelectedDepartmentIds((current) => {
      if (current.includes(departmentId)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((value) => value !== departmentId);
      }

      return [...current, departmentId];
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (resolvedSelectedDepartmentIds.length === 0) {
      setError("대상 부서를 최소 1개 이상 선택해 주세요.");
      return;
    }

    if (!primaryDepartmentId || !resolvedSelectedDepartmentIds.includes(primaryDepartmentId)) {
      setError("주관 부서를 대상 부서 안에서 선택해 주세요.");
      return;
    }

    setIsPending(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch("/api/directives", {
        body: JSON.stringify({
          content: String(formData.get("content") ?? ""),
          dueDate: String(formData.get("dueDate") ?? "") || null,
          isUrgent,
          ownerUserId: String(formData.get("ownerUserId") ?? "") || null,
          primaryDepartmentId,
          selectedDepartmentIds: resolvedSelectedDepartmentIds,
          targetScope,
          title: String(formData.get("title") ?? ""),
          urgentLevel: isUrgent ? Number(formData.get("urgentLevel") ?? 1) : null,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const result = await readApiResponse<{ id: string }>(response);
      router.replace(`/directives/${result.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "지시사항을 생성하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <CardTitle>지시사항 등록</CardTitle>
        <CardDescription>
          대표 지시 1건 아래에 주관 부서와 협조 부서를 함께 배정합니다. 전사 지시는 한 번만 만들고, 상세에서 부서별 이행 현황을 내려다볼 수 있게 구성했습니다.
        </CardDescription>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <FieldGroup>
          <FieldLabel label="지시 제목" required />
          <Input name="title" placeholder="예: 2분기 주요 거래처 진열 기준 즉시 점검" />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel label="지시 내용" required />
          <Textarea
            name="content"
            placeholder="현장에서 바로 이해할 수 있는 문장으로 실행 지시를 적어 주세요."
          />
        </FieldGroup>

        <section className="space-y-4 rounded-3xl border border-brand-100 bg-brand-50/60 p-5">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink-950">대상 범위</h3>
            <p className="text-sm text-ink-700">전사 전체 또는 특정 부서 여러 곳을 한 번에 배정할 수 있습니다.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {([
              {
                value: "ALL",
                title: "전사",
                description: "활성 부서를 모두 자동 대상화합니다.",
              },
              {
                value: "SELECTED",
                title: "특정 부서",
                description: "필요한 부서만 여러 개 골라서 배정합니다.",
              },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTargetScope(option.value)}
                className={cn(
                  "rounded-3xl border px-4 py-4 text-left transition",
                  targetScope === option.value
                    ? "border-brand-500 bg-white shadow-[0_16px_32px_rgba(20,76,160,0.08)]"
                    : "border-ink-200 bg-white hover:border-brand-200",
                )}
              >
                <p className="text-sm font-semibold text-ink-950">{option.title}</p>
                <p className="mt-1 text-sm text-ink-600">{option.description}</p>
              </button>
            ))}
          </div>

          {targetScope === "SELECTED" ? (
            <div className="space-y-3">
              <FieldLabel label="대상 부서 선택" required hint="최소 1개 이상 선택해 주세요." />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {activeDepartments.map((department) => {
                  const isSelected = resolvedSelectedDepartmentIds.includes(department.id);

                  return (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => toggleDepartment(department.id)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left text-sm transition",
                        isSelected
                          ? "border-brand-500 bg-white text-ink-950 shadow-[0_14px_28px_rgba(20,76,160,0.08)]"
                          : "border-ink-200 bg-white text-ink-700 hover:border-brand-200",
                      )}
                    >
                      <span className="font-semibold">{department.name}</span>
                      <span className="mt-1 block text-xs text-ink-500">{department.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm text-ink-700">
              현재 활성 부서 {activeDepartments.length}개가 모두 대상에 포함됩니다.
            </div>
          )}

          <div className="space-y-3">
            <FieldLabel label="선택된 대상 부서" required />
            {selectedDepartments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-200 px-4 py-3 text-sm text-ink-500">
                아직 선택된 부서가 없습니다.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedDepartments.map((department) => (
                  <span
                    key={department.id}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-semibold",
                      department.id === primaryDepartmentId
                        ? "bg-ink-950 text-white"
                        : "bg-white text-ink-700 ring-1 ring-ink-200",
                    )}
                  >
                    {department.name}
                    {department.id === primaryDepartmentId ? " · 주관" : " · 협조"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup>
            <FieldLabel label="주관 부서" required hint="상위 집계와 책임 부서 기준으로 사용됩니다." />
            <Select value={primaryDepartmentId} onChange={(event) => setPrimaryDepartmentId(event.target.value)}>
              {selectedDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="주관 담당자" hint="선택하지 않으면 부서 기준으로 진행합니다." />
            <Select name="ownerUserId" defaultValue="">
              <option value="">담당자 미지정</option>
              {primaryDepartmentUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <FieldGroup>
            <FieldLabel label="마감일" />
            <Input name="dueDate" type="datetime-local" />
          </FieldGroup>

          <label className="flex items-center gap-2 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-950">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(event) => setIsUrgent(event.target.checked)}
            />
            긴급 지시
          </label>

          {isUrgent ? (
            <FieldGroup>
              <FieldLabel label="긴급 레벨" />
              <Select name="urgentLevel" defaultValue="2">
                <option value="1">L1</option>
                <option value="2">L2</option>
                <option value="3">L3</option>
              </Select>
            </FieldGroup>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" size="lg" isLoading={isPending} loadingLabel="지시 등록 중">
            지시사항 등록
          </Button>
        </div>
      </form>
    </Card>
  );
}
