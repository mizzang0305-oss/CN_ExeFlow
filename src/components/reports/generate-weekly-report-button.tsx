"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";

export function GenerateWeeklyReportButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
      });

      await readApiResponse(response);
      window.location.reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "주간 결산을 생성하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="md" onClick={handleGenerate} isLoading={isPending} loadingLabel="결산 생성 중">
        이번 주 결산 생성
      </Button>
      {error ? <p className="text-sm text-danger-700">{error}</p> : null}
    </div>
  );
}
