"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/field";

type State = "checking" | "ready" | "expired" | "error" | "success";

function readUrlParams() {
  if (typeof window === "undefined") {
    return {
      hashParams: new URLSearchParams(),
      queryParams: new URLSearchParams(),
    };
  }

  return {
    hashParams: new URLSearchParams(window.location.hash.replace(/^#/, "")),
    queryParams: new URLSearchParams(window.location.search),
  };
}

function hasUnavailableResetLink(queryParams: URLSearchParams, hashParams: URLSearchParams) {
  const error = queryParams.get("error") ?? hashParams.get("error");
  const errorCode = queryParams.get("error_code") ?? hashParams.get("error_code");
  const errorDescription = queryParams.get("error_description") ?? hashParams.get("error_description");

  return error === "access_denied" || errorCode === "otp_expired" || Boolean(errorDescription);
}

function cleanResetUrl() {
  if (typeof window !== "undefined") {
    window.history.replaceState({}, document.title, "/reset-password");
  }
}

export function ResetPasswordClient() {
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPasswordPending, setIsPasswordPending] = useState(false);
  const [isResetPending, setIsResetPending] = useState(false);

  const title = useMemo(() => {
    if (state === "success") {
      return "비밀번호를 변경했습니다";
    }

    return "비밀번호 재설정";
  }, [state]);

  useEffect(() => {
    let isMounted = true;

    async function prepareRecoverySession() {
      setState("checking");
      setErrorMessage(null);
      setMessage(null);

      const { hashParams, queryParams } = readUrlParams();

      if (hasUnavailableResetLink(queryParams, hashParams)) {
        setState("expired");
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const code = queryParams.get("code");
        const tokenHash = queryParams.get("token_hash") ?? hashParams.get("token_hash");
        const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token");

        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);

          if (result.error) {
            throw result.error;
          }

          cleanResetUrl();
        } else if (tokenHash) {
          const result = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

          if (result.error) {
            throw result.error;
          }

          cleanResetUrl();
        } else if (accessToken && refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (result.error) {
            throw result.error;
          }

          cleanResetUrl();
        }

        const sessionResult = await supabase.auth.getSession();

        if (sessionResult.error || !sessionResult.data.session) {
          if (isMounted) {
            setState("error");
          }
          return;
        }

        if (isMounted) {
          setState("ready");
        }
      } catch {
        if (isMounted) {
          setState("error");
        }
      }
    }

    void prepareRecoverySession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setMessage(null);

    if (password.length < 8) {
      setErrorMessage("비밀번호를 8자 이상 입력해주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsPasswordPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        setState("error");
        setErrorMessage("비밀번호 재설정 인증이 필요합니다.");
        return;
      }

      const result = await supabase.auth.updateUser({ password });

      if (result.error) {
        throw result.error;
      }

      await supabase.auth.signOut();
      setPassword("");
      setPasswordConfirm("");
      setMessage("비밀번호를 변경했습니다. 다시 로그인해주세요.");
      setState("success");
    } catch {
      setErrorMessage("비밀번호를 변경하지 못했습니다. 재설정 링크를 다시 확인해주세요.");
    } finally {
      setIsPasswordPending(false);
    }
  }

  async function handleResetEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setMessage(null);

    const email = resetEmail.trim().toLowerCase();

    if (!email) {
      setErrorMessage("이메일을 입력해주세요.");
      return;
    }

    setIsResetPending(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        body: JSON.stringify({ email }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("RESET_REQUEST_FAILED");
      }

      setResetEmail("");
      setMessage("비밀번호 재설정 메일을 보냈습니다. 메일의 안내에 따라 다시 설정해주세요.");
    } catch {
      setErrorMessage("비밀번호 재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsResetPending(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#020814,#081425_56%,#0d1d31)] py-6 sm:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(47,130,237,0.14),transparent_22%),radial-gradient(circle_at_92%_18%,rgba(29,99,179,0.12),transparent_24%)]" />
      <div className="brand-grid absolute inset-0 opacity-[0.06]" />

      <div className="app-container relative flex min-h-screen items-center justify-center">
        <section className="w-full max-w-xl rounded-[32px] border border-white/90 bg-white/96 p-6 shadow-[0_32px_90px_rgba(3,19,38,0.18)] sm:p-8">
          <p className="text-sm font-bold text-brand-700">CN EXEFLOW</p>
          <h1 className="mt-3 text-3xl font-bold text-ink-950">{title}</h1>

          {state === "checking" ? (
            <div className="mt-5 rounded-[24px] border border-brand-100 bg-brand-50/80 px-5 py-5">
              <p className="text-lg font-bold text-brand-950">비밀번호 재설정 화면을 준비하고 있습니다.</p>
              <p className="mt-2 text-sm font-semibold text-brand-800">인증 정보를 확인하는 중입니다.</p>
            </div>
          ) : null}

          {state === "expired" ? (
            <ResetRequestPanel
              description="다시 재설정 메일을 요청해주세요."
              email={resetEmail}
              errorMessage={errorMessage}
              isPending={isResetPending}
              message={message}
              onEmailChange={setResetEmail}
              onSubmit={handleResetEmailSubmit}
              title="비밀번호 재설정 링크가 만료되었습니다."
            />
          ) : null}

          {state === "error" ? (
            <ResetRequestPanel
              description="메일의 재설정 링크를 다시 열어주세요."
              email={resetEmail}
              errorMessage={errorMessage}
              isPending={isResetPending}
              message={message}
              onEmailChange={setResetEmail}
              onSubmit={handleResetEmailSubmit}
              title="비밀번호 재설정 인증이 필요합니다."
            />
          ) : null}

          {state === "ready" ? (
            <form className="mt-6 space-y-4" onSubmit={(event) => void handlePasswordSubmit(event)}>
              <p className="text-sm font-semibold leading-6 text-ink-700">새 비밀번호를 입력해주세요.</p>
              <FieldGroup>
                <FieldLabel label="새 비밀번호" required />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="새 비밀번호를 입력해주세요"
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel label="새 비밀번호 확인" required />
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  placeholder="새 비밀번호를 다시 입력해주세요"
                />
              </FieldGroup>
              <Button type="submit" block size="lg" isLoading={isPasswordPending} loadingLabel="변경 중입니다">
                비밀번호 변경하기
              </Button>
            </form>
          ) : null}

          {state === "success" ? (
            <div className="mt-5 rounded-[24px] border border-success-200 bg-success-50 px-5 py-5">
              <p className="text-base font-bold text-success-800">{message ?? "비밀번호를 변경했습니다."}</p>
              <p className="mt-2 text-sm font-semibold text-success-700">다시 로그인해주세요.</p>
              <Link
                href="/login"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[20px] bg-brand-900 px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(7,32,63,0.22)]"
              >
                로그인으로 이동
              </Link>
            </div>
          ) : null}

          {state === "ready" && errorMessage ? (
            <div className="mt-4 rounded-[24px] border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700">
              {errorMessage}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function ResetRequestPanel({
  description,
  email,
  errorMessage,
  isPending,
  message,
  onEmailChange,
  onSubmit,
  title,
}: {
  description: string;
  email: string;
  errorMessage: string | null;
  isPending: boolean;
  message: string | null;
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  title: string;
}) {
  return (
    <div className="mt-5 rounded-[24px] border border-warning-200 bg-warning-50 px-5 py-5">
      <p className="text-lg font-bold text-warning-900">{title}</p>
      <p className="mt-2 text-sm font-semibold text-warning-800">{description}</p>
      <p className="mt-4 text-sm font-bold text-ink-900">재설정 메일 다시 받기</p>

      <form className="mt-4 space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <FieldGroup>
          <FieldLabel label="이메일" required />
          <Input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="회사 이메일을 입력해주세요"
          />
        </FieldGroup>
        <Button type="submit" block size="lg" isLoading={isPending} loadingLabel="발송 중입니다">
          재설정 메일 다시 보내기
        </Button>
      </form>

      {message ? (
        <div className="mt-4 rounded-[20px] border border-success-200 bg-success-50 px-4 py-3 text-sm font-bold text-success-800">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-[20px] border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
