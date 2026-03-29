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
import { SkeletonBlock } from "@/components/ui/skeleton-block";
import { StatusPill } from "@/components/ui/status-pill";

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
      <Card className="mx-auto w-full max-w-xl border-white/90 bg-white/94 p-6 sm:p-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <StatusPill tone="default">Access Sync</StatusPill>
            <div className="space-y-2">
              <CardTitle>접속 준비 중</CardTitle>
              <CardDescription>부서와 사용자 목록을 불러오며 진입 환경을 정렬하고 있습니다.</CardDescription>
            </div>
          </div>

          <div className="space-y-4">
            <SkeletonBlock className="h-24 rounded-[28px]" />
            <SkeletonBlock className="h-24 rounded-[28px]" />
            <SkeletonBlock className="h-16 rounded-[24px]" />
          </div>
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
          <Button size="md" variant="secondary" onClick={() => void loadBootstrap()}>
            다시 시도
          </Button>
        }
      />
    );
  }

  return (
    <Card className="mx-auto w-full max-w-xl border-white/90 bg-white/96 p-6 shadow-[0_32px_90px_rgba(3,19,38,0.12)] sm:p-8">
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="default">2단계 빠른 진입</StatusPill>
            <StatusPill tone={usersStatus === "loading" ? "warning" : "success"}>
              {usersStatus === "loading" ? "사용자 동기화 중" : "역할별 즉시 진입"}
            </StatusPill>
          </div>
          <div className="space-y-2">
            <CardTitle>운영 통제 플랫폼 진입</CardTitle>
            <CardDescription>
              부서와 사용자를 선택하면 역할에 맞는 실행 화면으로 즉시 이동합니다.
            </CardDescription>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-brand-100 bg-brand-50/75 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">Department</p>
              <p className="mt-2 text-sm font-semibold text-ink-950">부서 기준 진입</p>
            </div>
            <div className="rounded-[24px] border border-ink-200/80 bg-ink-100/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-600">Role</p>
              <p className="mt-2 text-sm font-semibold text-ink-950">권한별 홈 자동 연결</p>
            </div>
            <div className="rounded-[24px] border border-ink-200/80 bg-ink-100/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-600">Evidence</p>
              <p className="mt-2 text-sm font-semibold text-ink-950">로그와 증빙 흐름 이어짐</p>
            </div>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="rounded-[28px] border border-brand-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,244,255,0.86))] p-4">
              <FieldGroup className="space-y-3">
                <FieldLabel label="1. 부서 선택" required hint="로그인 가능한 부서를 먼저 선택합니다." />
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
            </div>

            <div className="rounded-[28px] border border-ink-200/80 bg-white/92 p-4">
              <FieldGroup className="space-y-3">
                <FieldLabel label="2. 사용자 선택" required hint="선택한 부서의 활성 사용자만 표시합니다." />
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
            </div>
          </div>

          {selectedDepartment ? (
            <div className="rounded-[28px] border border-brand-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,244,255,0.82))] px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-950">{selectedDepartment.name}</p>
                  <p className="mt-1 text-sm text-ink-700">
                    활성 사용자 {users.length}명
                    {selectedDepartment.headUserName ? ` · 부서장 ${selectedDepartment.headUserName}` : ""}
                  </p>
                </div>
                <StatusPill tone={usersStatus === "loading" ? "warning" : "default"}>
                  {usersStatus === "loading" ? "사용자 목록 갱신 중" : `${selectedDepartment.userCount}명 등록`}
                </StatusPill>
              </div>
            </div>
          ) : null}

          {usersStatus === "ready" && departmentId && users.length === 0 ? (
            <EmptyState
              title="활성 사용자가 없습니다"
              description="선택한 부서에 로그인 가능한 사용자가 아직 배정되지 않았습니다."
            />
          ) : null}

          {submitError ? (
            <div className="rounded-[24px] border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {submitError}
            </div>
          ) : null}

          <Button
            type="submit"
            block
            size="lg"
            disabled={!departmentId || !userId || usersStatus === "loading"}
            isLoading={isSubmitting}
            loadingLabel="CN EXEFLOW 입장 중"
          >
            CN EXEFLOW 시작
          </Button>
        </form>
      </div>
    </Card>
  );
}
