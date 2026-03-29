"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type SoftDeleteLogButtonProps = {
  directiveId: string;
  logId: string;
};

export function SoftDeleteLogButton({
  directiveId,
  logId,
}: SoftDeleteLogButtonProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(`/api/directives/${directiveId}/logs/${logId}`, {
        body: JSON.stringify({
          reason,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "행동 로그를 비노출 처리하지 못했습니다.");
        return;
      }

      router.refresh();
      setIsOpen(false);
    } catch {
      setError("행동 로그 삭제 요청을 처리하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  if (!isOpen) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        비노출 처리
      </Button>
    );
  }

  return (
    <div className="w-full max-w-xs space-y-2 rounded-2xl border border-danger-200 bg-danger-50 p-3">
      <p className="text-xs font-semibold text-danger-700">완전 삭제 대신 일반 화면에서 숨깁니다.</p>
      <Input
        placeholder="사유를 남기면 추적이 쉬워집니다"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="border-danger-200"
      />
      {error ? <p className="text-xs text-danger-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="danger" size="sm" onClick={handleDelete} disabled={isPending}>
          {isPending ? "처리 중" : "비노출"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} disabled={isPending}>
          취소
        </Button>
      </div>
    </div>
  );
}
