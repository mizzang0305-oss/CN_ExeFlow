"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { directiveLogTypeLabels } from "@/features/directives/constants";
import type { DirectiveDepartmentProgress, DirectiveLogItem } from "@/features/directives/types";
import { validateDirectiveLogSubmission } from "@/features/directives/validation";
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
      setError("로그를 작성할 부서를 선택해주세요.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedFiles = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0 && Boolean(value.name));
    const validationMessage = validateDirectiveLogSubmission({
      actionSummary: String(formData.get("actionSummary") ?? ""),
      attachmentCount: (initialLog?.attachmentCount ?? 0) + selectedFiles.length,
      detail: String(formData.get("detail") ?? ""),
      happenedAt: String(formData.get("happenedAt") ?? ""),
      logType: String(formData.get("logType") ?? ""),
    });

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsPending(true);

    try {
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
          현장에서 바로 기록할 수 있도록 핵심 항목만 남겼습니다. 선택한 부서의 실행 이력과 증빙이 즉시 상세 화면에 반영됩니다.
        </CardDescription>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {allowDepartmentSelect ? (
          <FieldGroup>
            <FieldLabel label="로그 부서" required hint="여러 부서가 배정된 지시일 때만 선택할 수 있습니다." />
            <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              {selectableDepartments.map((department) => (
                <option key={department.departmentId} value={department.departmentId}>
                  {department.departmentName ?? "부서 미지정"}
                  {department.isPrimary ? " · 주관" : " · 협업"}
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
            <Select name="logType" defaultValue={initialLog?.logType ?? ""}>
              <option value="">선택해주세요</option>
              {logTypeOptions.map((logType) => (
                <option key={logType} value={logType}>
                  {directiveLogTypeLabels[logType]}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="조치 일시" required />
            <Input
              name="happenedAt"
              type="datetime-local"
              defaultValue={toDateTimeLocalValue(initialLog?.happenedAt)}
            />
          </FieldGroup>
        </div>

        <FieldGroup>
          <FieldLabel label="로그 제목" required hint="공백과 기호만 입력할 수 없고, 최소 2자 이상이어야 합니다." />
          <Input
            name="actionSummary"
            placeholder="예: 1차 매장 진열 점검 완료"
            defaultValue={initialLog?.actionSummary ?? ""}
          />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel
            label="로그 내용"
            hint="내용 또는 증빙 파일 중 하나는 반드시 필요합니다. 내용을 적는 경우 5자 이상 입력해주세요."
          />
          <Textarea
            name="detail"
            placeholder="예: 진열 상태를 확인했고 교체 대상 3건을 정리해 공유했습니다."
            defaultValue={initialLog?.detail ?? ""}
          />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup>
            <FieldLabel label="다음 조치" />
            <Input
              name="nextAction"
              placeholder="예: 내일 오전 10시까지 수정 진열 완료"
              defaultValue={initialLog?.nextAction ?? ""}
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="리스크 메모" />
            <Input
              name="riskNote"
              placeholder="예: 자재 입고 지연 가능성 있음"
              defaultValue={initialLog?.riskNote ?? ""}
            />
          </FieldGroup>
        </div>

        <FieldGroup>
          <FieldLabel label="증빙 파일" hint="사진, 문서, 캡처 등 필요한 파일을 함께 올려주세요." />
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
