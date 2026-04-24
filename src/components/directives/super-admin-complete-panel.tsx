"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel, Textarea } from "@/components/ui/field";

type SuperAdminCompletePanelProps = {
  directiveId: string;
};

export function SuperAdminCompletePanel({ directiveId }: SuperAdminCompletePanelProps) {
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(`/api/directives/${directiveId}/complete-all`, {
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
      setError(caughtError instanceof Error ? caughtError.message : "통합 완료를 처리하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-ink-950">슈퍼관리자 통합 완료</h2>
        <p className="text-sm leading-6 text-ink-700">
          텍스트 로그를 5자 이상 남기면 배정된 모든 부서를 즉시 완료 처리합니다. 기존 부서별 완료 요청과 승인 절차는
          건너뜁니다.
        </p>
      </div>

      <FieldGroup>
        <FieldLabel
          label="통합 완료 로그"
          hint="예: 현장 확인과 후속 조치 검토까지 마쳤고 전체 지시사항을 종료합니다."
        />
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="완료 근거를 5자 이상 입력해주세요."
        />
      </FieldGroup>

      {error ? (
        <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      ) : null}

      <div className="flex justify-end">
        <Button
          size="md"
          onClick={() => void handleComplete()}
          isLoading={isPending}
          loadingLabel="통합 완료 처리 중"
        >
          통합 완료 로그 등록
        </Button>
      </div>
    </div>
  );
}
