"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { MasterDepartmentItem, MasterUserItem } from "@/features/master/types";
import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";

type DirectiveFormProps = {
  departments: MasterDepartmentItem[];
  users: MasterUserItem[];
};

export function DirectiveForm({ departments, users }: DirectiveFormProps) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departmentUsers = useMemo(
    () =>
      users.filter((user) => user.isActive && user.departmentId === departmentId),
    [departmentId, users],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch("/api/directives", {
        body: JSON.stringify({
          content: String(formData.get("content") ?? ""),
          dueDate: String(formData.get("dueDate") ?? "") || null,
          isUrgent,
          ownerDepartmentId: departmentId,
          ownerUserId: String(formData.get("ownerUserId") ?? "") || null,
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
    <Card className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <CardTitle>지시사항 등록</CardTitle>
        <CardDescription>
          대표 지시를 전사 실행 플로우에 올리는 시작점입니다. 현장에서 바로 실행할 수 있도록 제목과 부서, 마감일 중심으로 간단히 입력합니다.
        </CardDescription>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <FieldGroup>
          <FieldLabel label="지시 제목" required />
          <Input name="title" placeholder="예: 2분기 냉장 진열 표준 전 점포 적용" />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel label="지시 내용" required />
          <Textarea
            name="content"
            placeholder="현장에서 이해하기 쉬운 문장으로 핵심 지시사항을 적어 주세요."
          />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup>
            <FieldLabel label="담당 부서" required />
            <Select name="ownerDepartmentId" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="담당자" hint="선택하지 않으면 부서 기준으로 진행합니다." />
            <Select name="ownerUserId" defaultValue="">
              <option value="">담당자 미지정</option>
              {departmentUsers.map((user) => (
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
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "등록 중..." : "지시사항 등록"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
