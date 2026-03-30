"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { readApiResponse } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ActivateAccountResult,
  AuthLoginResult,
  AuthenticatedUserProfile,
  InitialSetupLookupData,
  LoginBootstrapData,
  RegisterCompanyEmailResult,
} from "@/features/auth/types";
import { COMPANY_EMAIL_DOMAIN, roleLabelMap } from "@/features/auth/utils";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLabel, Input, Select } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/status-pill";

type LoginMode = "login" | "recovery" | "reset" | "setup";

type LoginFormProps = {
  bootstrapData: LoginBootstrapData;
};

async function fetchApi<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  });

  return readApiResponse<T>(response);
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-brand-100/80 bg-white/92 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink-950">{value}</p>
    </div>
  );
}

function SetupProfile({
  existingEmail,
  user,
}: {
  existingEmail: string | null;
  user: AuthenticatedUserProfile;
}) {
  const hasCompanyEmail = user.hasCompanyEmail;
  const showExistingEmailNote = existingEmail && !hasCompanyEmail;

  return (
    <div className="rounded-[28px] border border-brand-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,244,255,0.86))] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="default">사용자 확인 완료</StatusPill>
        <StatusPill tone={hasCompanyEmail ? "warning" : "success"}>
          {hasCompanyEmail ? "회사 이메일 등록 완료" : "회사 이메일 미등록"}
        </StatusPill>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SummaryItem label="이름" value={user.displayName} />
        <SummaryItem label="부서" value={user.departmentName ?? "미배정"} />
        <SummaryItem label="직책" value={user.title ?? "미등록"} />
        <SummaryItem label="역할" value={roleLabelMap[user.role]} />
      </div>

      {showExistingEmailNote ? (
        <div className="mt-4 rounded-[22px] border border-warning-200 bg-warning-50/80 px-4 py-3 text-sm text-warning-800">
          현재 저장된 이메일: <span className="font-semibold">{existingEmail}</span>
          <br />
          회사 이메일이 아니므로 미등록 상태로 판단하여 최초 사용자 설정을 계속할 수 있습니다.
        </div>
      ) : null}
    </div>
  );
}

function StepPill({
  description,
  isActive,
  isComplete,
  title,
}: {
  description: string;
  isActive: boolean;
  isComplete: boolean;
  title: string;
}) {
  return (
    <div
      className={
        isActive
          ? "rounded-[24px] border border-brand-300 bg-brand-50/90 px-4 py-4"
          : isComplete
            ? "rounded-[24px] border border-success-200 bg-success-50/90 px-4 py-4"
            : "rounded-[24px] border border-ink-200/80 bg-ink-100/70 px-4 py-4"
      }
    >
      <p className="text-sm font-semibold text-ink-950">{title}</p>
      <p className="mt-2 text-xs leading-5 text-ink-600">{description}</p>
    </div>
  );
}

export function LoginForm({ bootstrapData }: LoginFormProps) {
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [lookupResult, setLookupResult] = useState<InitialSetupLookupData | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const availableUsers = bootstrapData.users.filter((user) => user.departmentId === selectedDepartmentId);
  const selectedUser =
    availableUsers.find((user) => user.id === selectedUserId) ??
    bootstrapData.users.find((user) => user.id === selectedUserId) ??
    null;
  const setupProfile = lookupResult?.profile ?? null;
  const resolvedSetupEmail = registeredEmail ?? (setupProfile?.hasCompanyEmail ? setupProfile.email : null);
  const setupStep = !setupProfile ? 1 : !resolvedSetupEmail ? 2 : 3;

  useEffect(() => {
    if (!selectedDepartmentId) {
      setSelectedUserId("");
      return;
    }

    if (availableUsers.length === 0) {
      setSelectedUserId("");
      return;
    }

    const userStillVisible = availableUsers.some((user) => user.id === selectedUserId);

    if (!userStillVisible) {
      setSelectedUserId(availableUsers[0]?.id ?? "");
    }
  }, [availableUsers, selectedDepartmentId, selectedUserId]);

  useEffect(() => {
    const isRecoveryMode =
      searchParams.get("mode") === "recovery" || window.location.hash.includes("access_token");

    if (isRecoveryMode) {
      setMode("recovery");
      setInfoMessage("재설정 링크가 확인되었습니다. 새 비밀번호를 입력해주세요.");
      setErrorMessage(null);
      return;
    }

    if (searchParams.get("setup") === "completed") {
      const completedEmail = searchParams.get("email")?.trim().toLowerCase() ?? "";

      if (completedEmail) {
        setEmail(completedEmail);
      }

      setMode("login");
      setInfoMessage("비밀번호 설정이 완료되었습니다. 이메일로 로그인해주세요.");
      setErrorMessage(null);
    }
  }, [searchParams]);

  function resetSetupState() {
    setLookupResult(null);
    setRegisteredEmail(null);
    setSetupEmail("");
    setSetupPassword("");
    setSetupPasswordConfirm("");
  }

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    setInfoMessage(null);
    setErrorMessage(null);

    if (nextMode !== "setup") {
      resetSetupState();
    }
  }

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await fetchApi<AuthLoginResult>("/api/auth/login", {
        body: JSON.stringify({
          email,
          password,
          rememberMe,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      window.location.assign(result.redirectTo);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그인을 완료하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleLookupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDepartmentId || !selectedUser) {
      setErrorMessage("부서와 이름을 선택해주세요.");
      setInfoMessage(null);
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const params = new URLSearchParams({
        departmentId: selectedDepartmentId,
        name: selectedUser.name,
        userId: selectedUser.id,
      });
      const result = await fetchApi<InitialSetupLookupData>(`/api/auth/lookup-user?${params.toString()}`);

      setLookupResult(result);
      setRegisteredEmail(result.profile?.hasCompanyEmail ? result.profile.email : null);
      setSetupEmail(result.profile?.hasCompanyEmail ? result.profile.email ?? "" : "");
      setSetupPassword("");
      setSetupPasswordConfirm("");

      if (!result.canRegisterCompanyEmail) {
        setInfoMessage(
          "이미 회사 이메일이 등록된 사용자입니다. 이메일 로그인 또는 비밀번호 재설정을 이용해주세요.",
        );
      } else {
        setInfoMessage("사용자 정보를 확인했습니다. 회사 이메일을 등록해주세요.");
      }
    } catch (error) {
      setLookupResult(null);
      setRegisteredEmail(null);
      setErrorMessage(error instanceof Error ? error.message : "사용자 정보를 확인하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleRegisterEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!setupProfile) {
      setErrorMessage("먼저 부서와 이름으로 사용자를 확인해주세요.");
      setInfoMessage(null);
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await fetchApi<RegisterCompanyEmailResult>("/api/auth/register-email", {
        body: JSON.stringify({
          email: setupEmail,
          userId: setupProfile.userId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setRegisteredEmail(result.email);
      setLookupResult((current) =>
        current && current.profile
          ? {
              ...current,
              canRegisterCompanyEmail: false,
              existingEmail: result.email,
              profile: {
                ...current.profile,
                email: result.email,
                hasCompanyEmail: true,
              },
            }
          : current,
      );
      setInfoMessage(result.message);
      setEmail(result.email);
      setSetupEmail(result.email);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "회사 이메일을 등록하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleActivateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!setupProfile) {
      setErrorMessage("먼저 사용자 정보를 확인해주세요.");
      setInfoMessage(null);
      return;
    }

    if (!resolvedSetupEmail) {
      setErrorMessage("회사 이메일을 먼저 등록해주세요.");
      setInfoMessage(null);
      return;
    }

    if (setupPassword.length < 8) {
      setErrorMessage("비밀번호를 8자 이상 입력해주세요.");
      setInfoMessage(null);
      return;
    }

    if (setupPassword !== setupPasswordConfirm) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      setInfoMessage(null);
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await fetchApi<ActivateAccountResult>("/api/auth/activate", {
        body: JSON.stringify({
          password: setupPassword,
          passwordConfirm: setupPasswordConfirm,
          userId: setupProfile.userId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      window.location.assign(result.redirectTo);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "비밀번호 설정을 완료하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await fetchApi<{ requested: true }>("/api/auth/reset-password", {
        body: JSON.stringify({
          email: resetEmail,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setInfoMessage("비밀번호 재설정 메일을 보냈습니다. 메일의 안내에 따라 다시 설정해주세요.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "비밀번호 재설정 메일을 보내지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleRecoverySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      if (recoveryPassword.length < 8) {
        throw new Error("비밀번호를 8자 이상 입력해주세요.");
      }

      if (recoveryPassword !== recoveryPasswordConfirm) {
        throw new Error("비밀번호 확인이 일치하지 않습니다.");
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("재설정 세션이 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.");
      }

      const updateResult = await supabase.auth.updateUser({
        password: recoveryPassword,
      });

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }

      await supabase.auth.signOut();
      setMode("login");
      setRecoveryPassword("");
      setRecoveryPasswordConfirm("");
      window.history.replaceState({}, document.title, "/login");
      setInfoMessage("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-xl border-white/90 bg-white/96 p-6 shadow-[0_32px_90px_rgba(3,19,38,0.12)] sm:p-8">
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="default">이메일 로그인</StatusPill>
            <StatusPill tone="muted">최초 설정 후 회사 이메일로 로그인합니다</StatusPill>
          </div>

          <div className="space-y-2">
            <CardTitle>CN EXEFLOW 로그인</CardTitle>
            <CardDescription>
              최초 사용자 설정은 부서와 이름으로 본인을 확인한 뒤 회사 이메일과 비밀번호를 등록합니다.
              이후에는 회사 이메일과 비밀번호로 로그인합니다.
            </CardDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <StepPill
              title="로그인"
              description="회사 이메일과 비밀번호로 바로 로그인합니다."
              isActive={mode === "login"}
              isComplete={false}
            />
            <StepPill
              title="최초 사용자 설정"
              description="부서와 이름으로 사용자를 찾은 뒤 회사 이메일을 등록합니다."
              isActive={mode === "setup"}
              isComplete={false}
            />
            <StepPill
              title="비밀번호 재설정"
              description="등록된 회사 이메일로 비밀번호 재설정 메일을 보냅니다."
              isActive={mode === "reset" || mode === "recovery"}
              isComplete={false}
            />
            <StepPill
              title="자동 로그인"
              description="로그인 상태 유지를 선택하면 다음 접속부터 바로 진입합니다."
              isActive={false}
              isComplete={rememberMe}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["login", "로그인"],
              ["setup", "최초 사용자 설정"],
              ["reset", "비밀번호 재설정"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value as LoginMode)}
                className={
                  mode === value
                    ? "rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-full bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === "login" ? (
          <form className="space-y-4" onSubmit={handleLoginSubmit}>
            <FieldGroup>
              <FieldLabel label="이메일" required hint={`회사 이메일(${COMPANY_EMAIL_DOMAIN})로 로그인해주세요.`} />
              <Input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={`name${COMPANY_EMAIL_DOMAIN}`}
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="비밀번호" required />
              <Input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호를 입력해주세요"
              />
            </FieldGroup>

            <label className="inline-flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border border-ink-300 text-brand-700"
              />
              로그인 상태 유지
            </label>

            <Button type="submit" block size="lg" isLoading={isPending} loadingLabel="로그인 중">
              로그인
            </Button>

            <div className="flex flex-wrap gap-3 text-sm font-semibold text-ink-600">
              <button type="button" onClick={() => switchMode("setup")}>
                최초 사용자 설정
              </button>
              <button type="button" onClick={() => switchMode("reset")}>
                비밀번호 재설정
              </button>
            </div>
          </form>
        ) : null}

        {mode === "setup" ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StepPill
                title="1단계 사용자 확인"
                description="부서와 이름으로 본인 계정을 찾습니다."
                isActive={setupStep === 1}
                isComplete={setupStep > 1}
              />
              <StepPill
                title="2단계 이메일 등록"
                description="회사 이메일을 등록하고 중복을 확인합니다."
                isActive={setupStep === 2}
                isComplete={setupStep > 2}
              />
              <StepPill
                title="3단계 비밀번호 설정"
                description="비밀번호를 설정한 뒤 이메일 로그인으로 전환합니다."
                isActive={setupStep === 3}
                isComplete={false}
              />
            </div>

            <form className="space-y-4" onSubmit={handleLookupSubmit}>
              <FieldGroup>
                <FieldLabel label="부서" required />
                <Select
                  value={selectedDepartmentId}
                  onChange={(event) => {
                    setSelectedDepartmentId(event.target.value);
                    resetSetupState();
                    setInfoMessage(null);
                    setErrorMessage(null);
                  }}
                >
                  <option value="">부서를 선택해주세요</option>
                  {bootstrapData.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel label="이름" required />
                <Select
                  value={selectedUserId}
                  onChange={(event) => {
                    setSelectedUserId(event.target.value);
                    resetSetupState();
                    setInfoMessage(null);
                    setErrorMessage(null);
                  }}
                  disabled={!selectedDepartmentId}
                >
                  <option value="">이름을 선택해주세요</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                      {user.title ? ` · ${user.title}` : ""}
                    </option>
                  ))}
                </Select>
              </FieldGroup>

              <Button type="submit" size="md" isLoading={isPending} loadingLabel="확인 중">
                사용자 정보 확인
              </Button>
            </form>

            {setupProfile ? <SetupProfile existingEmail={lookupResult?.existingEmail ?? null} user={setupProfile} /> : null}

            {setupProfile && lookupResult?.canRegisterCompanyEmail ? (
              <form className="space-y-4" onSubmit={handleRegisterEmailSubmit}>
                <FieldGroup>
                  <FieldLabel
                    label="회사 이메일"
                    required
                    hint={`입력값은 공백 제거 및 소문자 변환 후 ${COMPANY_EMAIL_DOMAIN} 도메인으로 저장됩니다.`}
                  />
                  <Input
                    type="email"
                    value={registeredEmail ?? setupEmail}
                    onChange={(event) => {
                      setRegisteredEmail(null);
                      setSetupEmail(event.target.value);
                    }}
                    placeholder={`name${COMPANY_EMAIL_DOMAIN}`}
                  />
                </FieldGroup>

                <Button type="submit" size="md" isLoading={isPending} loadingLabel="이메일 등록 중">
                  이메일 등록
                </Button>
              </form>
            ) : null}

            {setupProfile && resolvedSetupEmail ? (
              <form className="space-y-4" onSubmit={handleActivateSubmit}>
                <FieldGroup>
                  <FieldLabel label="등록된 회사 이메일" required />
                  <Input type="email" value={resolvedSetupEmail} readOnly className="bg-ink-50 text-ink-700" />
                </FieldGroup>

                <FieldGroup>
                  <FieldLabel label="비밀번호 설정" required hint="비밀번호는 8자 이상 입력해주세요." />
                  <Input
                    type="password"
                    value={setupPassword}
                    onChange={(event) => setSetupPassword(event.target.value)}
                    placeholder="비밀번호를 입력해주세요"
                  />
                </FieldGroup>

                <FieldGroup>
                  <FieldLabel label="비밀번호 확인" required />
                  <Input
                    type="password"
                    value={setupPasswordConfirm}
                    onChange={(event) => setSetupPasswordConfirm(event.target.value)}
                    placeholder="비밀번호를 다시 입력해주세요"
                  />
                </FieldGroup>

                <Button type="submit" size="lg" isLoading={isPending} loadingLabel="비밀번호 설정 중">
                  완료
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}

        {mode === "reset" ? (
          <form className="space-y-4" onSubmit={handleResetSubmit}>
            <FieldGroup>
              <FieldLabel
                label="이메일"
                required
                hint="등록된 회사 이메일로 비밀번호 재설정 메일을 보냅니다."
              />
              <Input
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                placeholder={`name${COMPANY_EMAIL_DOMAIN}`}
              />
            </FieldGroup>

            <Button type="submit" size="lg" isLoading={isPending} loadingLabel="메일 발송 중">
              비밀번호 재설정 메일 보내기
            </Button>
          </form>
        ) : null}

        {mode === "recovery" ? (
          <form className="space-y-4" onSubmit={handleRecoverySubmit}>
            <FieldGroup>
              <FieldLabel label="새 비밀번호" required />
              <Input
                type="password"
                value={recoveryPassword}
                onChange={(event) => setRecoveryPassword(event.target.value)}
                placeholder="새 비밀번호를 입력해주세요"
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="새 비밀번호 확인" required />
              <Input
                type="password"
                value={recoveryPasswordConfirm}
                onChange={(event) => setRecoveryPasswordConfirm(event.target.value)}
                placeholder="새 비밀번호를 다시 입력해주세요"
              />
            </FieldGroup>

            <Button type="submit" size="lg" isLoading={isPending} loadingLabel="비밀번호 변경 중">
              비밀번호 변경 완료
            </Button>
          </form>
        ) : null}

        {infoMessage ? (
          <div className="rounded-[24px] border border-brand-200 bg-brand-50/80 px-4 py-3 text-sm text-brand-800">
            {infoMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-[24px] border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
