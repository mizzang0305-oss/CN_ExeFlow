"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { StaffWorkspaceData } from "@/features/dashboard";
import { formatDateLabel, formatDateTimeLabel, formatRelativeUpdate } from "@/lib";
import { readApiResponse } from "@/lib/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldGroup, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";

type StaffWorkspaceClientProps = {
  data: StaffWorkspaceData;
};

function DirectiveMiniList({
  description,
  emptyDescription,
  emptyTitle,
  items,
  title,
}: {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  items: StaffWorkspaceData["myAssignedItems"];
  title: string;
}) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="mt-1 text-sm text-ink-700">{description}</p>
      </div>

      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/directives/${item.id}`}
              className="block rounded-[24px] border border-ink-200/90 bg-white px-4 py-4 transition hover:border-brand-300 hover:bg-brand-50/35"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.isDelayed ? "danger" : item.currentDepartmentStatus === "REJECTED" ? "warning" : "default"}>
                  {item.isDelayed ? "지연" : item.currentDepartmentStatus === "REJECTED" ? "반려" : "진행"}
                </Badge>
                <Badge tone="muted">{item.directiveNo}</Badge>
              </div>
              <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
              <p className="mt-2 text-sm text-ink-700">
                {item.ownerDepartmentName ?? "미지정 부서"} · 마감 {formatDateLabel(item.dueDate)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function StaffWorkspaceClient({ data }: StaffWorkspaceClientProps) {
  const router = useRouter();
  const [directiveId, setDirectiveId] = useState(data.quickLogOptions[0]?.directiveId ?? "");
  const [logType, setLogType] = useState("STATUS_NOTE");
  const [actionSummary, setActionSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const selectedDirective = useMemo(
    () => data.quickLogOptions.find((item) => item.directiveId === directiveId) ?? null,
    [data.quickLogOptions, directiveId],
  );

  async function handleQuickSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedDirective) {
      setError("로그를 등록할 지시를 선택해주세요.");
      return;
    }

    if (!actionSummary.trim()) {
      setError("조치 요약을 입력해주세요.");
      return;
    }

    setIsPending(true);

    try {
      const formData = new FormData();
      formData.set("departmentId", selectedDirective.departmentId ?? "");
      formData.set("actionSummary", actionSummary.trim());
      formData.set("detail", detail.trim());
      formData.set("happenedAt", new Date().toISOString());
      formData.set("logType", logType);

      for (const file of files) {
        formData.append("attachments", file);
      }

      const response = await fetch(`/api/directives/${selectedDirective.directiveId}/logs`, {
        body: formData,
        method: "POST",
      });

      await readApiResponse(response);
      setActionSummary("");
      setDetail("");
      setFiles([]);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "빠른 로그 등록에 실패했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.summaryCards.map((card) => (
          <Card key={card.label} className="space-y-3">
            <Badge tone={card.tone === "muted" ? "default" : card.tone}>{card.label}</Badge>
            <p className="text-4xl font-semibold tracking-tight text-ink-950">{card.value}</p>
            {card.description ? <p className="text-sm leading-6 text-ink-700">{card.description}</p> : null}
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="space-y-4">
          <div>
            <h2 className="section-title">빠른 실행 로그</h2>
            <p className="mt-1 text-sm text-ink-700">모바일에서도 바로 로그와 증빙을 올릴 수 있도록 최소 입력으로 구성했습니다.</p>
          </div>

          <form className="space-y-4" onSubmit={handleQuickSubmit}>
            <FieldGroup>
              <FieldLabel label="지시 선택" required />
              <Select value={directiveId} onChange={(event) => setDirectiveId(event.target.value)}>
                <option value="">지시를 선택해주세요</option>
                {data.quickLogOptions.map((option) => (
                  <option key={option.directiveId} value={option.directiveId}>
                    {option.directiveNo} · {option.title}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup>
                <FieldLabel label="로그 유형" required />
                <Select value={logType} onChange={(event) => setLogType(event.target.value)}>
                  <option value="STATUS_NOTE">상태 메모</option>
                  <option value="VISIT">현장 방문</option>
                  <option value="PHOTO_UPLOADED">사진 업로드</option>
                  <option value="ISSUE_FOUND">이슈 발견</option>
                  <option value="ISSUE_RESOLVED">이슈 해결</option>
                </Select>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel label="증빙 첨부" hint="사진 또는 문서를 함께 올릴 수 있습니다." />
                <Input
                  type="file"
                  multiple
                  className="h-auto py-3"
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </FieldGroup>
            </div>

            <FieldGroup>
              <FieldLabel label="조치 요약" required />
              <Input value={actionSummary} onChange={(event) => setActionSummary(event.target.value)} placeholder="예: 매장 진열 보완 완료" />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="상세 내용" hint="증빙만 첨부하는 경우에도 간단한 메모를 남기는 것을 권장합니다." />
              <Textarea value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="현장 조치 내용과 다음 행동을 남겨주세요." />
            </FieldGroup>

            {selectedDirective ? (
              <div className="rounded-[24px] border border-brand-100/80 bg-brand-50/65 px-4 py-4 text-sm text-ink-700">
                {selectedDirective.departmentName ?? "미지정 부서"} · 마감 {formatDateLabel(selectedDirective.dueDate)}
              </div>
            ) : null}

            {error ? <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div> : null}

            <Button type="submit" size="lg" isLoading={isPending} loadingLabel="저장 중">
              빠른 로그 저장
            </Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="section-title">내 최근 로그</h2>
            <p className="mt-1 text-sm text-ink-700">현장에서 최근에 남긴 로그를 다시 확인할 수 있습니다.</p>
          </div>

          {data.recentLogs.length === 0 ? (
            <EmptyState title="최근 로그가 없습니다." description="첫 실행 로그를 남기면 이 영역에서 바로 확인할 수 있습니다." />
          ) : (
            <div className="space-y-3">
              {data.recentLogs.map((log) => (
                <Link
                  key={log.logId}
                  href={`/directives/${log.directiveId}#log-${log.logId}`}
                  className="block rounded-[24px] border border-ink-200/90 bg-white px-4 py-4 transition hover:border-brand-300 hover:bg-brand-50/35"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="default">{log.directiveNo}</Badge>
                    <span className="text-xs text-ink-500">{formatDateTimeLabel(log.happenedAt)}</span>
                    <span className="text-xs text-ink-500">{formatRelativeUpdate(log.happenedAt)}</span>
                  </div>
                  <p className="mt-3 text-base font-semibold text-ink-950">{log.actionSummary}</p>
                  <p className="mt-1 text-sm text-ink-700">
                    {log.directiveTitle}
                    {log.departmentName ? ` · ${log.departmentName}` : ""}
                    {` · 첨부 ${log.attachmentCount}건`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DirectiveMiniList
          title="내 담당 지시"
          description="실무 담당자로 직접 배정된 지시를 우선 보여줍니다."
          emptyTitle="직접 배정된 지시가 없습니다."
          emptyDescription="부서 공용 항목만 있는 경우 아래 부서 지원 항목을 확인해주세요."
          items={data.myAssignedItems}
        />
        <DirectiveMiniList
          title="부서 지원 항목"
          description="직접 배정이 없어도 현재 부서에서 바로 처리해야 할 항목을 함께 보여줍니다."
          emptyTitle="부서 지원 항목이 없습니다."
          emptyDescription="현재 부서에서 실무 지원이 필요한 지시가 없습니다."
          items={data.departmentSupportItems}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DirectiveMiniList
          title="마감 임박"
          description="7일 안에 마감되는 항목입니다."
          emptyTitle="마감 임박 항목이 없습니다."
          emptyDescription="가까운 마감 항목이 없으면 이 영역이 비어 있습니다."
          items={data.dueSoonItems}
        />
        <DirectiveMiniList
          title="반려 및 증빙 보완"
          description="반려된 항목과 증빙이 부족한 항목을 우선 정리했습니다."
          emptyTitle="보완이 필요한 항목이 없습니다."
          emptyDescription="반려나 증빙 부족 항목이 없으면 이 영역이 비어 있습니다."
          items={[...data.rejectedItems, ...data.missingEvidenceItems].slice(0, 8)}
        />
      </section>
    </div>
  );
}
