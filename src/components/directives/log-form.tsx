"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { DirectiveDepartmentProgress, DirectiveLogItem } from "@/features/directives/types";
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
  defaultDepartmentId: string | null;
  departments: DirectiveDepartmentProgress[];
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

export function LogForm({ defaultDepartmentId, departments, directiveId, initialLog, mode }: LogFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode === "edit";
  const [departmentId, setDepartmentId] = useState(
    initialLog?.departmentId ?? defaultDepartmentId ?? departments[0]?.departmentId ?? "",
  );
  const selectableDepartments = useMemo(
    () => departments.filter((department) => department.departmentId),
    [departments],
  );
  const allowDepartmentSelect = selectableDepartments.length > 1 && !defaultDepartmentId;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!departmentId) {
      setError("로그를 남길 부서를 선택해 주세요.");
      return;
    }

    setIsPending(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      formData.set("departmentId", departmentId);
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
          현장에서 바로 적을 수 있도록 핵심 항목만 남겼습니다. 선택한 부서의 실행 이력과 증빙이 즉시 상세 화면에 반영됩니다.
        </CardDescription>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {allowDepartmentSelect ? (
          <FieldGroup>
            <FieldLabel label="로그 부서" required hint="여러 부서가 배정된 지시일 때만 선택합니다." />
            <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              {selectableDepartments.map((department) => (
                <option key={department.departmentId} value={department.departmentId}>
                  {department.departmentName ?? "부서 미지정"}
                  {department.isPrimary ? " · 주관" : " · 협조"}
                </option>
              ))}
            </Select>
          </FieldGroup>
        ) : (
          <input type="hidden" name="departmentId" value={departmentId} />
        )}

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
          <FieldLabel label="행동 요약" required hint="10초 안에 읽히는 문장으로 적어 주세요." />
          <Input
            name="actionSummary"
            placeholder="예: 매장 입구 POP 교체 일정 확정"
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
          <Button
            type="submit"
            size="lg"
            isLoading={isPending}
            loadingLabel={isEdit ? "로그 수정 중" : "로그 저장 중"}
          >
            {isEdit ? "수정 저장" : "로그 저장"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
