"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DirectiveLogItem } from "@/features/directives/types";
import { directiveLogTypeLabels } from "@/features/directives/constants";
import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";

const logTypeOptions = [
  "VISIT",
  "CALL",
  "MEETING",
  "DOCUMENT_SUBMITTED",
  "ISSUE_FOUND",
  "ISSUE_RESOLVED",
  "PHOTO_UPLOADED",
  "STATUS_NOTE",
] as const;

type LogFormProps = {
  directiveId: string;
  initialLog?: DirectiveLogItem;
  mode: "create" | "edit";
};

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  }

  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function LogForm({ directiveId, initialLog, mode }: LogFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode === "edit";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch(
        isEdit
          ? `/api/directives/${directiveId}/logs/${initialLog?.id}`
          : `/api/directives/${directiveId}/logs`,
        {
          body: formData,
          method: isEdit ? "PATCH" : "POST",
        },
      );

      await readApiResponse(response);
      router.replace(`/directives/${directiveId}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "행동 로그를 저장하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <CardTitle>{isEdit ? "행동 로그 수정" : "행동 로그 등록"}</CardTitle>
        <CardDescription>
          현장에서 바로 남길 수 있도록 필요한 항목만 묶었습니다. 사진과 문서는 한 번에 여러 개 첨부할 수 있습니다.
        </CardDescription>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup>
            <FieldLabel label="로그 유형" required />
            <Select name="logType" defaultValue={initialLog?.logType ?? "VISIT"}>
              {logTypeOptions.map((logType) => (
                <option key={logType} value={logType}>
                  {directiveLogTypeLabels[logType]}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="조치 시각" required />
            <Input
              name="happenedAt"
              type="datetime-local"
              defaultValue={toDateTimeLocalValue(initialLog?.happenedAt)}
            />
          </FieldGroup>
        </div>

        <FieldGroup>
          <FieldLabel
            label="행동 요약"
            required
            hint="10초 안에 읽히는 짧은 문장으로 적어 주세요."
          />
          <Input
            name="actionSummary"
            placeholder="예: 현장 점검 후 간판 교체 일정 확정"
            defaultValue={initialLog?.actionSummary ?? ""}
          />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel label="상세 내용" hint="필요할 때만 조금 더 설명해 주세요." />
          <Textarea
            name="detail"
            placeholder="진행 내용과 결과를 간단히 기록합니다."
            defaultValue={initialLog?.detail ?? ""}
          />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup>
            <FieldLabel label="다음 액션" />
            <Input
              name="nextAction"
              placeholder="예: 4월 2일 자재 교체 완료 예정"
              defaultValue={initialLog?.nextAction ?? ""}
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="리스크 메모" />
            <Input
              name="riskNote"
              placeholder="예: 자재 수급 지연 가능성"
              defaultValue={initialLog?.riskNote ?? ""}
            />
          </FieldGroup>
        </div>

        <FieldGroup>
          <FieldLabel label="사진 / 문서 증빙" hint="여러 파일을 한 번에 첨부할 수 있습니다." />
          <Input name="attachments" type="file" multiple className="h-auto py-3" />
        </FieldGroup>

        {error ? (
          <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href={`/directives/${directiveId}`} className="text-sm font-semibold text-ink-500">
            상세로 돌아가기
          </Link>
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "저장 중..." : isEdit ? "수정 저장" : "로그 저장"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
