"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel, Textarea } from "@/components/ui/field";

type WorkflowActionPanelProps = {
  canApprove?: boolean;
  canReject?: boolean;
  canRequestCompletion?: boolean;
  canResumeProgress?: boolean;
  departmentId: string;
  departmentLabel: string;
  directiveId: string;
  helperText?: string;
};

export function WorkflowActionPanel({
  canApprove = false,
  canReject = false,
  canRequestCompletion = false,
  canResumeProgress = false,
  departmentId,
  departmentLabel,
  directiveId,
  helperText,
}: WorkflowActionPanelProps) {
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canRequestCompletion && !canApprove && !canReject && !canResumeProgress) {
    return null;
  }

  async function runAction(endpoint: string) {
    setError(null);
    setIsPending(endpoint);

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({ departmentId, reason }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      await readApiResponse(response);
      setReason("");
      window.location.reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "상태 변경을 처리하지 못했습니다.");
    } finally {
      setIsPending(null);
    }
  }

  const memoLabel = canRequestCompletion ? "결과 요약" : "처리 메모";
  const memoHint = canRequestCompletion
    ? "완료 요청 시 결과 요약을 5자 이상 입력해야 합니다."
    : "승인, 반려, 재진행 사유를 남겨두면 추적에 도움이 됩니다.";
  const memoPlaceholder = canRequestCompletion
    ? "예: 진열 교체와 증빙 업로드를 모두 완료했고 현장 확인까지 마쳤습니다."
    : "예: 추가 증빙 확인 완료 / 보완 후 재진행 승인";

  return (
    <div className="space-y-4 rounded-3xl border border-ink-200 bg-white p-5">
      <div>
        <h3 className="text-base font-semibold text-ink-950">{departmentLabel} 상태 처리</h3>
        <p className="mt-1 text-sm text-ink-700">
          부서 단위로 완료 요청, 승인, 반려, 재진행을 처리하고 상위 지시 상태는 자동으로 다시 집계됩니다.
        </p>
        {helperText ? <p className="mt-2 text-sm text-ink-600">{helperText}</p> : null}
      </div>

      <FieldGroup>
        <FieldLabel label={memoLabel} hint={memoHint} />
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={memoPlaceholder}
        />
      </FieldGroup>

      {error ? (
        <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canRequestCompletion ? (
          <Button
            size="md"
            onClick={() => void runAction(`/api/directives/${directiveId}/request-completion`)}
            disabled={Boolean(isPending)}
            isLoading={isPending === `/api/directives/${directiveId}/request-completion`}
            loadingLabel="요청 중"
          >
            완료 요청
          </Button>
        ) : null}

        {canResumeProgress ? (
          <Button
            size="md"
            variant="secondary"
            onClick={() => void runAction(`/api/directives/${directiveId}/resume-progress`)}
            disabled={Boolean(isPending)}
            isLoading={isPending === `/api/directives/${directiveId}/resume-progress`}
            loadingLabel="재진행 처리 중"
          >
            재진행
          </Button>
        ) : null}

        {canApprove ? (
          <Button
            size="md"
            onClick={() => void runAction(`/api/directives/${directiveId}/approve-completion`)}
            disabled={Boolean(isPending)}
            isLoading={isPending === `/api/directives/${directiveId}/approve-completion`}
            loadingLabel="승인 중"
          >
            승인
          </Button>
        ) : null}

        {canReject ? (
          <Button
            variant="danger"
            size="md"
            onClick={() => void runAction(`/api/directives/${directiveId}/reject-completion`)}
            disabled={Boolean(isPending)}
            isLoading={isPending === `/api/directives/${directiveId}/reject-completion`}
            loadingLabel="반려 중"
          >
            반려
          </Button>
        ) : null}
      </div>
    </div>
  );
}
