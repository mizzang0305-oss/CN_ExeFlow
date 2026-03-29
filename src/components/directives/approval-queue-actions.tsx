"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";

type ApprovalQueueActionsProps = {
  departmentId: string;
  directiveId: string;
};

export function ApprovalQueueActions({ departmentId, directiveId }: ApprovalQueueActionsProps) {
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: "approve" | "reject") {
    setError(null);
    setPendingAction(action);

    try {
      const response = await fetch(
        `/api/directives/${directiveId}/${action === "approve" ? "approve-completion" : "reject-completion"}`,
        {
          body: JSON.stringify({ departmentId }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      await readApiResponse(response);
      window.location.reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "처리를 완료하지 못했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => void handleAction("approve")}
          isLoading={pendingAction === "approve"}
          loadingLabel="승인 중"
          disabled={Boolean(pendingAction)}
        >
          승인
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => void handleAction("reject")}
          isLoading={pendingAction === "reject"}
          loadingLabel="반려 중"
          disabled={Boolean(pendingAction)}
        >
          반려
        </Button>
      </div>
      {error ? <p className="text-sm text-danger-700">{error}</p> : null}
    </div>
  );
}
