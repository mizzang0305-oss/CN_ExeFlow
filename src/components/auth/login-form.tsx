"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { LoginDepartmentOption } from "@/features/auth/types";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLabel, Select } from "@/components/ui/field";

type LoginFormProps = {
  departments: LoginDepartmentOption[];
};

export function LoginForm({ departments }: LoginFormProps) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [userId, setUserId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === departmentId) ?? null,
    [departmentId, departments],
  );

  const users = selectedDepartment?.users ?? [];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          departmentId,
          userId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        setError(payload.error ?? "로그인에 실패했습니다.");
        return;
      }

      router.push(payload.redirectTo ?? "/directives");
      router.refresh();
    } catch {
      setError("로그인 요청을 처리하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-lg p-6 sm:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
            빠른 진입
          </span>
          <CardTitle>부서와 사용자를 선택해 바로 들어가세요</CardTitle>
          <CardDescription>
            현장 사용자는 자기 부서 흐름으로, 대표와 전략기획팀은 전체 대시보드로 연결됩니다.
          </CardDescription>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <FieldLabel label="부서" required />
            <Select
              name="departmentId"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setUserId("");
              }}
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="사용자" required />
            <Select
              name="userId"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              disabled={users.length === 0}
            >
              <option value="">사용자를 선택하세요</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.role}
                </option>
              ))}
            </Select>
          </FieldGroup>

          {selectedDepartment ? (
            <div className="rounded-2xl bg-ink-100 px-4 py-3 text-sm text-ink-700">
              <p className="font-semibold text-ink-950">{selectedDepartment.name}</p>
              <p className="mt-1">{selectedDepartment.users.length}명의 활성 사용자가 있습니다.</p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" block size="lg" disabled={!departmentId || !userId || isPending}>
            {isPending ? "진입 중..." : "로그인"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
