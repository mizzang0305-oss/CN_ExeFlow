"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/field";

type RecoveryStatus = "checking" | "expired" | "invalid" | "ready" | "success";

function isUnavailableResetLink(error: string | null, errorCode: string | null) {
  return error === "access_denied" || errorCode === "otp_expired";
}

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const title = useMemo(() => {
    if (status === "success") {
      return "비밀번호를 변경했습니다";
    }

    return "비밀번호 재설정";
  }, [status]);

  useEffect(() => {
    let isMounted = true;

    async function prepareRecoverySession() {
      setStatus("checking");
      setErrorMessage(null);

      const error = searchParams.get("error");
      const errorCode = searchParams.get("error_code");

      if (isUnavailableResetLink(error, errorCode)) {
        setStatus("expired");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");

      try {
        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);

          if (result.error) {
            throw result.error;
          }

          window.history.replaceState({}, document.title, "/reset-password");
        } else if (tokenHash) {
          const result = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

          if (result.error) {
            throw result.error;
          }

          window.history.replaceState({}, document.title, "/reset-password");
        } else {
          const result = await supabase.auth.getSession();

          if (result.error || !result.data.session) {
            setStatus("invalid");
            return;
          }
        }

        if (isMounted) {
          setStatus("ready");
        }
      } catch {
        if (isMounted) {
          setStatus("expired");
        }
      }
    }

    void prepareRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [queryString, searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

    setIsPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.updateUser({ password });

      if (result.error) {
        throw result.error;
      }

      await supabase.auth.signOut();
      setPassword("");
      setPasswordConfirm("");
      setMessage("비밀번호를 변경했습니다. 다시 로그인해주세요.");
      setStatus("success");
    } catch {
      setErrorMessage("비밀번호를 변경하지 못했습니다. 재설정 링크를 다시 확인해주세요.");
    } finally {
      setIsPending(false);
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

          {status === "checking" ? (
            <p className="mt-4 text-sm font-semibold text-ink-700">재설정 링크를 확인하고 있습니다.</p>
          ) : null}

          {status === "expired" ? (
            <div className="mt-5 rounded-[24px] border border-warning-200 bg-warning-50 px-5 py-5">
              <p className="text-lg font-bold text-warning-900">비밀번호 재설정 링크가 만료되었습니다.</p>
              <p className="mt-2 text-sm font-semibold text-warning-800">다시 재설정 메일을 요청해주세요.</p>
              <Link
                href="/login?mode=reset"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[20px] bg-brand-900 px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(7,32,63,0.22)]"
              >
                재설정 메일 다시 받기
              </Link>
            </div>
          ) : null}

          {status === "invalid" ? (
            <div className="mt-5 rounded-[24px] border border-warning-200 bg-warning-50 px-5 py-5">
              <p className="text-lg font-bold text-warning-900">재설정 세션을 확인하지 못했습니다.</p>
              <p className="mt-2 text-sm font-semibold text-warning-800">다시 재설정 메일을 요청해주세요.</p>
              <Link
                href="/login?mode=reset"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[20px] bg-brand-900 px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(7,32,63,0.22)]"
              >
                재설정 메일 다시 받기
              </Link>
            </div>
          ) : null}

          {status === "ready" ? (
            <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
              <Button type="submit" block size="lg" isLoading={isPending} loadingLabel="변경 중">
                비밀번호 변경
              </Button>
            </form>
          ) : null}

          {status === "success" ? (
            <div className="mt-5 rounded-[24px] border border-success-200 bg-success-50 px-5 py-5">
              <p className="text-base font-bold text-success-800">{message ?? "비밀번호를 변경했습니다."}</p>
              <p className="mt-2 text-sm font-semibold text-success-700">다시 로그인해주세요.</p>
              <Link
                href="/login"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[20px] bg-brand-900 px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(7,32,63,0.22)]"
              >
                로그인 화면으로 이동
              </Link>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-4 rounded-[24px] border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700">
              {errorMessage}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
