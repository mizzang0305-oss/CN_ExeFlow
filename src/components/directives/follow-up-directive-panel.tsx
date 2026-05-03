"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { readApiResponse } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";

type FollowUpDepartmentOption = {
  departmentId: string;
  departmentName: string | null;
};

type FollowUpDirectivePanelProps = {
  departments: FollowUpDepartmentOption[];
  directiveId: string;
};

export function FollowUpDirectivePanel({ departments, directiveId }: FollowUpDirectivePanelProps) {
  const [content, setContent] = useState("");
  const [requestDepartmentId, setRequestDepartmentId] = useState(departments[0]?.departmentId ?? "");
  const [dueDate, setDueDate] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsPending(true);

    try {
      const formData = new FormData();
      formData.set("content", content);
      formData.set("requestDepartmentId", requestDepartmentId);
      formData.set("dueDate", dueDate);
      formData.set("isUrgent", String(isUrgent));

      for (const file of Array.from(files ?? [])) {
        formData.append("attachments", file);
      }

      const response = await fetch(`/api/directives/${directiveId}/follow-ups`, {
        body: formData,
        method: "POST",
      });
      await readApiResponse(response);
      setContent("");
      setDueDate("");
      setIsUrgent(false);
      setFiles(null);
      setMessage("추가 지시가 등록되었습니다.");
      window.location.reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "추가 지시를 등록하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-3xl border border-brand-100 bg-brand-50/70 p-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-ink-950">추가 지시 등록</h2>
        <p className="text-sm leading-6 text-ink-700">
          기존 지시사항 아래에 후속 지시를 남깁니다. 담당자는 완료 요청만 할 수 있고 최종 완료는 승인권자가 처리합니다.
        </p>
      </div>

      <FieldGroup>
        <FieldLabel label="요청 부서" required />
        <Select
          value={requestDepartmentId}
          onChange={(event) => setRequestDepartmentId(event.target.value)}
          aria-label="요청 부서 선택"
          required
        >
          {departments.map((department) => (
            <option key={department.departmentId} value={department.departmentId}>
              {department.departmentName ?? "부서 미지정"}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <FieldGroup>
        <FieldLabel label="추가 지시 내용" required />
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="후속 지시 내용을 입력해주세요."
          required
          rows={5}
        />
      </FieldGroup>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldGroup>
          <FieldLabel label="마감일" />
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            aria-label="마감일 선택"
          />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel label="파일 첨부" />
          <Input
            type="file"
            multiple
            onChange={(event) => setFiles(event.target.files)}
            aria-label="추가 지시 파일 첨부"
          />
        </FieldGroup>
      </div>

      <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm font-bold text-ink-800">
        <input
          type="checkbox"
          checked={isUrgent}
          onChange={(event) => setIsUrgent(event.target.checked)}
          className="h-4 w-4"
        />
        긴급 지시로 표시
      </label>

      {message ? <div className="rounded-2xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700">{error}</div> : null}

      <div className="flex justify-end">
        <Button type="submit" size="md" isLoading={isPending} loadingLabel="등록 중">
          추가 지시 등록
        </Button>
      </div>
    </form>
  );
}
