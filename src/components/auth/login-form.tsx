"use client";

import { useEffect, useMemo, useState } from "react";

import type { ApiResponse } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuthLoginResult, AuthLookupResult, AuthenticatedUserProfile } from "@/features/auth/types";
import { roleLabelMap } from "@/features/auth/utils";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/status-pill";

type LoginMode = "activate" | "login" | "recovery" | "reset";

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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-brand-100/80 bg-white/92 px-4 py-4">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-500 uppercase">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink-950">{value}</p>
    </div>
  );
}

function LookupProfile({ user }: { user: AuthenticatedUserProfile }) {
  return (
    <div className="rounded-[28px] border border-brand-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,244,255,0.86))] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="default">조직 기준 정보</StatusPill>
        <StatusPill tone={user.isActivated ? "warning" : "success"}>
          {user.isActivated ? "최초 설정 완료" : "최초 설정 가능"}
        </StatusPill>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SummaryItem label="이름" value={user.displayName} />
        <SummaryItem label="부서" value={user.departmentName ?? "미배정"} />
        <SummaryItem label="직책" value={user.title ?? "미등록"} />
        <SummaryItem label="역할" value={roleLabelMap[user.role]} />
      </div>
    </div>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<AuthLookupResult | null>(null);
  const [activationPassword, setActivationPassword] = useState("");
  const [activationPasswordConfirm, setActivationPasswordConfirm] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const activationUser = useMemo(() => lookupResult?.user ?? null, [lookupResult]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const isRecoveryMode =
      url.searchParams.get("mode") === "recovery" || window.location.hash.includes("access_token");

    if (isRecoveryMode) {
      setMode("recovery");
      setInfoMessage("재설정 링크를 확인했습니다. 새 비밀번호를 입력해주세요.");
    }
  }, []);

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    setInfoMessage(null);
    setErrorMessage(null);
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
    setIsPending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await fetchApi<AuthLookupResult>(
        `/api/auth/lookup-user?email=${encodeURIComponent(lookupEmail)}`,
      );

      setLookupResult(result);

      if (!result.found || !result.user) {
        setInfoMessage("해당 이메일로 등록된 활성 사용자 정보를 찾지 못했습니다.");
        return;
      }

      if (result.user.isActivated) {
        setInfoMessage("이미 최초 설정이 완료된 사용자입니다. 로그인 또는 비밀번호 재설정을 이용해주세요.");
        return;
      }

      setInfoMessage("조직 기준 정보를 확인했습니다. 비밀번호를 설정하고 시작해주세요.");
    } catch (error) {
      setLookupResult(null);
      setErrorMessage(error instanceof Error ? error.message : "사용자 정보를 확인하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleActivationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      if (!activationUser) {
        throw new Error("먼저 이메일로 사용자 정보를 확인해주세요.");
      }

      if (activationPassword !== activationPasswordConfirm) {
        throw new Error("비밀번호 확인이 일치하지 않습니다.");
      }

      const result = await fetchApi<AuthLoginResult>("/api/auth/activate", {
        body: JSON.stringify({
          email: lookupEmail,
          password: activationPassword,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      window.location.assign(result.redirectTo);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "최초 사용자 설정을 완료하지 못했습니다.");
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

      setInfoMessage("입력한 이메일로 비밀번호 재설정 안내를 전송했습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "재설정 요청을 보내지 못했습니다.");
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
      setInfoMessage("비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요.");
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
            <StatusPill tone="muted">최초 활성화 · 증빙 중심 운영</StatusPill>
          </div>

          <div className="space-y-2">
            <CardTitle>운영 통제 시스템 접속</CardTitle>
            <CardDescription>
              이메일 인증은 Supabase Auth로 처리하고, 조직 정보는 기준 테이블에 연결된 상태로 유지합니다.
            </CardDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["로그인", "이메일과 비밀번호로 바로 접속합니다."],
              ["최초 설정", "사전 등록된 사용자만 활성화합니다."],
              ["재설정", "비밀번호 재설정 메일을 요청합니다."],
              ["자동 로그인", "로그인 상태 유지로 재접속을 단순화합니다."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-[22px] border border-ink-200/80 bg-ink-100/70 px-4 py-4">
                <p className="text-sm font-semibold text-ink-950">{title}</p>
                <p className="mt-2 text-xs leading-5 text-ink-600">{description}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["login", "로그인"],
              ["activate", "최초 사용자 설정"],
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
              <FieldLabel label="이메일" required />
              <Input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@cnfood.co.kr"
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

            <div className="flex flex-wrap gap-2">
              <Button type="submit" block size="lg" isLoading={isPending} loadingLabel="로그인 중">
                로그인
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 text-sm font-semibold text-ink-600">
              <button type="button" onClick={() => switchMode("activate")}>
                최초 사용자 설정
              </button>
              <button type="button" onClick={() => switchMode("reset")}>
                비밀번호 재설정
              </button>
            </div>
          </form>
        ) : null}

        {mode === "activate" ? (
          <div className="space-y-5">
            <form className="space-y-4" onSubmit={handleLookupSubmit}>
              <FieldGroup>
                <FieldLabel label="이메일" required hint="사전에 조직 기준 사용자로 등록된 이메일만 활성화할 수 있습니다." />
                <Input
                  type="email"
                  value={lookupEmail}
                  onChange={(event) => setLookupEmail(event.target.value)}
                  placeholder="name@cnfood.co.kr"
                />
              </FieldGroup>

              <Button type="submit" size="md" isLoading={isPending} loadingLabel="확인 중">
                사용자 정보 확인
              </Button>
            </form>

            {activationUser ? <LookupProfile user={activationUser} /> : null}

            {activationUser && !activationUser.isActivated ? (
              <form className="space-y-4" onSubmit={handleActivationSubmit}>
                <FieldGroup>
                  <FieldLabel label="비밀번호 설정" required hint="이름, 부서, 직책, 역할은 조직 기준 정보로 고정됩니다." />
                  <Input
                    type="password"
                    value={activationPassword}
                    onChange={(event) => setActivationPassword(event.target.value)}
                    placeholder="영문과 숫자를 포함한 8자 이상"
                  />
                </FieldGroup>

                <FieldGroup>
                  <FieldLabel label="비밀번호 확인" required />
                  <Input
                    type="password"
                    value={activationPasswordConfirm}
                    onChange={(event) => setActivationPasswordConfirm(event.target.value)}
                    placeholder="비밀번호를 다시 입력해주세요"
                  />
                </FieldGroup>

                <Button type="submit" size="lg" isLoading={isPending} loadingLabel="설정 중">
                  시작하기
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}

        {mode === "reset" ? (
          <form className="space-y-4" onSubmit={handleResetSubmit}>
            <FieldGroup>
              <FieldLabel label="이메일" required hint="최초 설정이 완료된 사용자에게만 재설정 메일이 발송됩니다." />
              <Input
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                placeholder="name@cnfood.co.kr"
              />
            </FieldGroup>

            <Button type="submit" size="lg" isLoading={isPending} loadingLabel="전송 중">
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

            <Button type="submit" size="lg" isLoading={isPending} loadingLabel="변경 중">
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
