"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel, Textarea } from "@/components/ui/field";

type WorkflowActionPanelProps = {
  canApprove: boolean;
  canReject: boolean;
  canRequestCompletion: boolean;
  directiveId: string;
};

export function WorkflowActionPanel({
  canApprove,
  canReject,
  canRequestCompletion,
  directiveId,
}: WorkflowActionPanelProps) {
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canRequestCompletion && !canApprove && !canReject) {
    return null;
  }

  async function runAction(endpoint: string) {
    setError(null);
    setIsPending(endpoint);

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({ reason }),
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

  return (
    <div className="space-y-4 rounded-3xl border border-ink-200 bg-white p-5">
      <div>
        <h3 className="text-base font-semibold text-ink-950">승인 / 반려 흐름</h3>
        <p className="mt-1 text-sm text-ink-700">
          실행이 충분히 남겨졌다면 완료 요청을 올리고, 대표 또는 전략기획은 승인과 반려를 여기에서 처리합니다.
        </p>
      </div>

      <FieldGroup>
        <FieldLabel label="사유 메모" hint="반려나 승인 메모가 있으면 남겨 주세요." />
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="예: 증빙 확인 완료 / 추가 사진 보강 필요"
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
          >
            {isPending === `/api/directives/${directiveId}/request-completion` ? "요청 중..." : "완료 요청"}
          </Button>
        ) : null}

        {canApprove ? (
          <Button
            size="md"
            onClick={() => void runAction(`/api/directives/${directiveId}/approve-completion`)}
            disabled={Boolean(isPending)}
          >
            {isPending === `/api/directives/${directiveId}/approve-completion` ? "승인 중..." : "승인"}
          </Button>
        ) : null}

        {canReject ? (
          <Button
            variant="danger"
            size="md"
            onClick={() => void runAction(`/api/directives/${directiveId}/reject-completion`)}
            disabled={Boolean(isPending)}
          >
            {isPending === `/api/directives/${directiveId}/reject-completion` ? "반려 중..." : "반려"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
