"use client";

import { useEffect, useMemo, useState } from "react";

import type { ApiResponse } from "@/types";
import type {
  LoginBootstrapData,
  LoginDepartmentOption,
  LoginUserOption,
  LoginUsersData,
  SessionCreateResult,
} from "@/features/auth/types";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldGroup, FieldLabel, Select } from "@/components/ui/field";

async function fetchApi<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(!payload.ok ? payload.error.message : "요청을 처리하지 못했습니다.");
  }

  return payload.data;
}

export function LoginForm() {
  const [departments, setDepartments] = useState<LoginDepartmentOption[]>([]);
  const [users, setUsers] = useState<LoginUserOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [userId, setUserId] = useState("");
  const [bootstrapStatus, setBootstrapStatus] = useState<"error" | "loading" | "ready">("loading");
  const [usersStatus, setUsersStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === departmentId) ?? null,
    [departmentId, departments],
  );

  async function loadBootstrap() {
    setBootstrapStatus("loading");
    setErrorMessage(null);

    try {
      const data = await fetchApi<LoginBootstrapData>("/api/login/bootstrap");
      setDepartments(data.departments);
      const initialDepartmentId = data.departments[0]?.id ?? "";
      setDepartmentId(initialDepartmentId);
      setUserId("");
      setBootstrapStatus("ready");
    } catch (error) {
      setBootstrapStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "부서 목록을 불러오지 못했습니다.");
    }
  }

  async function loadUsers(nextDepartmentId: string) {
    if (!nextDepartmentId) {
      setUsers([]);
      setUsersStatus("idle");
      return;
    }

    setUsersStatus("loading");
    setSubmitError(null);

    try {
      const data = await fetchApi<LoginUsersData>(
        `/api/login/users?departmentId=${encodeURIComponent(nextDepartmentId)}`,
      );
      setUsers(data.users);
      setUsersStatus("ready");
    } catch (error) {
      setUsers([]);
      setUsersStatus("error");
      setSubmitError(error instanceof Error ? error.message : "부서 사용자 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (bootstrapStatus === "ready") {
      void loadUsers(departmentId);
    }
  }, [bootstrapStatus, departmentId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const data = await fetchApi<SessionCreateResult>("/api/login/session", {
        body: JSON.stringify({
          departmentId,
          userId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      window.location.assign(data.redirectTo);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "로그인 요청을 완료하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (bootstrapStatus === "loading") {
    return (
      <Card className="mx-auto w-full max-w-xl p-8">
        <div className="space-y-3">
          <CardTitle>접속 준비 중</CardTitle>
          <CardDescription>부서와 사용자 목록을 불러오고 있습니다.</CardDescription>
        </div>
      </Card>
    );
  }

  if (bootstrapStatus === "error") {
    return (
      <EmptyState
        title="로그인 준비 정보를 불러오지 못했습니다"
        description={errorMessage ?? "부서와 사용자 기본 정보를 다시 불러와 주세요."}
        action={
          <Button size="md" onClick={() => void loadBootstrap()}>
            다시 시도
          </Button>
        }
      />
    );
  }

  return (
    <Card className="mx-auto w-full max-w-xl p-6 sm:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            2단계 빠른 진입
          </span>
          <CardTitle>부서를 고르고 사용자로 바로 진입합니다</CardTitle>
          <CardDescription>
            부서와 사용자를 선택하면 역할에 맞는 화면으로 바로 이동합니다.
          </CardDescription>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <FieldLabel label="1. 부서 선택" required />
            <Select
              name="departmentId"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setUserId("");
              }}
            >
              <option value="">부서를 선택해 주세요</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="2. 사용자 선택" required />
            <Select
              name="userId"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              disabled={!departmentId || usersStatus === "loading"}
            >
              <option value="">
                {usersStatus === "loading" ? "사용자 불러오는 중" : "사용자를 선택해 주세요"}
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} · {user.role}
                </option>
              ))}
            </Select>
          </FieldGroup>

          {selectedDepartment ? (
            <div className="rounded-3xl border border-brand-100 bg-brand-50/70 px-4 py-4 text-sm text-ink-700">
              <p className="font-semibold text-ink-950">{selectedDepartment.name}</p>
              <p className="mt-1">
                활성 사용자 {users.length}명
                {selectedDepartment.headUserName ? ` · 부서장 ${selectedDepartment.headUserName}` : ""}
              </p>
            </div>
          ) : null}

          {usersStatus === "ready" && departmentId && users.length === 0 ? (
            <EmptyState
              title="활성 사용자가 없습니다"
              description="선택한 부서에 로그인 가능한 사용자가 아직 배정되지 않았습니다."
            />
          ) : null}

          {submitError ? (
            <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{submitError}</div>
          ) : null}

          <Button
            type="submit"
            block
            size="lg"
            disabled={!departmentId || !userId || isSubmitting || usersStatus === "loading"}
          >
            {isSubmitting ? "접속 중..." : "CN EXEFLOW 시작"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
