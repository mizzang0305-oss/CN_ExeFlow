"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";

import {
  BULK_DIRECTIVE_STATUS_BADGE_LABELS,
  BULK_DIRECTIVE_TEMPLATE_FILE_NAME,
  BULK_DIRECTIVE_TEMPLATE_PATH,
} from "@/features/bulk-directives/constants";
import type {
  BulkDirectiveBatchItem,
  BulkDirectiveManagementData,
  BulkDirectivePreviewResponse,
  BulkDirectiveRegisterResult,
  BulkDirectiveReplaceRegisterResult,
  BulkDirectiveArchiveResult,
} from "@/features/bulk-directives/types";
import { readApiResponse } from "@/lib/api";
import { cn, formatDateTimeLabel } from "@/lib";

import { Button } from "@/components/ui/button";

type BulkTab = "archive" | "history" | "replace" | "upload";

const tabs: Array<{ id: BulkTab; label: string }> = [
  { id: "upload", label: "지시사항 일괄등록" },
  { id: "replace", label: "지시사항 전체 교체" },
  { id: "history", label: "등록 내역" },
  { id: "archive", label: "일괄 비노출" },
];

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function statusBadgeClass(status: BulkDirectiveBatchItem["status"]) {
  if (status === "REGISTERED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "CANCELED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "FAILED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-brand-100 bg-brand-50 text-brand-800";
}

export function BulkDataManagementClient({ initialData }: { initialData: BulkDirectiveManagementData }) {
  const [activeTab, setActiveTab] = useState<BulkTab>("upload");
  const [batches, setBatches] = useState(initialData.batches);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkDirectivePreviewResponse | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacePreview, setReplacePreview] = useState<BulkDirectivePreviewResponse | null>(null);
  const [replaceConfirmText, setReplaceConfirmText] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [archiveBatchId, setArchiveBatchId] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isReplacePreviewing, setIsReplacePreviewing] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  const selectableRows = useMemo(() => preview?.rows.filter((row) => row.valid && row.batchRowId) ?? [], [preview]);
  const selectedCount = selectedRowIds.length;

  function refreshBatchStatus(batchId: string, updates: Partial<BulkDirectiveBatchItem>) {
    setBatches((current) => current.map((batch) => (batch.id === batchId ? { ...batch, ...updates } : batch)));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setSelectedRowIds([]);
    setMessage(null);
    setError(null);
  }

  function handleReplaceFileChange(event: ChangeEvent<HTMLInputElement>) {
    setReplaceFile(event.target.files?.[0] ?? null);
    setReplacePreview(null);
    setReplaceConfirmText("");
    setMessage(null);
    setError(null);
  }

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!file) {
      setError("업로드할 엑셀 파일을 선택해주세요.");
      return;
    }

    setIsPreviewing(true);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/admin/bulk-directives/preview", {
        body: formData,
        method: "POST",
      });
      const result = await readApiResponse<BulkDirectivePreviewResponse>(response);

      setPreview(result);
      setSelectedRowIds(result.rows.filter((row) => row.valid && row.batchRowId).map((row) => row.batchRowId as string));
      setMessage("검증 완료");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "엑셀 검증을 완료하지 못했습니다.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleRegisterSelected() {
    if (!preview) {
      setError("먼저 엑셀 파일을 검증해주세요.");
      return;
    }

    if (selectedRowIds.length === 0) {
      setError("등록할 행을 선택해주세요.");
      return;
    }

    setMessage(null);
    setError(null);
    setIsRegistering(true);

    try {
      const response = await fetch("/api/admin/bulk-directives/register", {
        body: JSON.stringify({
          batchId: preview.batchId,
          selectedRowIds,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await readApiResponse<BulkDirectiveRegisterResult>(response);

      refreshBatchStatus(preview.batchId, {
        registeredAt: new Date().toISOString(),
        registeredCount: result.registeredCount,
        status: "REGISTERED",
      });
      setMessage(result.message);
      setSelectedRowIds([]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "선택한 지시사항을 등록하지 못했습니다.");
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleReplacePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!replaceFile) {
      setError("전체 교체에 사용할 엑셀 파일을 선택해주세요.");
      return;
    }

    setIsReplacePreviewing(true);

    try {
      const formData = new FormData();
      formData.set("file", replaceFile);

      const response = await fetch("/api/admin/bulk-directives/replace-preview", {
        body: formData,
        method: "POST",
      });
      const result = await readApiResponse<BulkDirectivePreviewResponse>(response);

      setReplacePreview(result);
      setReplaceConfirmText("");
      setMessage("전체 교체 검증 완료");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "전체 교체 검증을 완료하지 못했습니다.");
    } finally {
      setIsReplacePreviewing(false);
    }
  }

  async function handleReplaceRegister() {
    if (!replacePreview) {
      setError("먼저 전체 교체 엑셀 파일을 검증해주세요.");
      return;
    }

    if (replacePreview.invalidRows > 0) {
      setError("오류가 있는 행이 있어 전체 교체를 실행할 수 없습니다.");
      return;
    }

    if (replaceConfirmText.trim() !== "전체교체") {
      setError("확인 문구로 전체교체를 입력해주세요.");
      return;
    }

    setMessage(null);
    setError(null);
    setIsReplacing(true);

    try {
      const response = await fetch("/api/admin/bulk-directives/replace-register", {
        body: JSON.stringify({
          batchId: replacePreview.batchId,
          confirmText: replaceConfirmText.trim(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await readApiResponse<BulkDirectiveReplaceRegisterResult>(response);

      refreshBatchStatus(replacePreview.batchId, {
        archivedDirectivesCount: result.archivedCount,
        registeredAt: new Date().toISOString(),
        registeredCount: result.registeredCount,
        status: "REGISTERED",
      });
      setMessage(result.message);
      setReplaceConfirmText("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "전체 교체를 완료하지 못했습니다.");
    } finally {
      setIsReplacing(false);
    }
  }

  async function handleArchiveBatch(batchId = archiveBatchId) {
    const reason = archiveReason.trim();

    if (!batchId) {
      setError("비노출할 등록 내역을 선택해주세요.");
      return;
    }

    if (!reason) {
      setError("비노출 사유를 입력해주세요.");
      return;
    }

    setMessage(null);
    setError(null);
    setIsArchiving(true);

    try {
      const response = await fetch("/api/admin/bulk-directives/archive", {
        body: JSON.stringify({
          batchId,
          reason,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await readApiResponse<BulkDirectiveArchiveResult>(response);

      refreshBatchStatus(batchId, { status: "CANCELED" });
      setMessage(result.message);
      setArchiveBatchId("");
      setArchiveReason("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "선택한 지시사항을 화면에서 숨기지 못했습니다.");
    } finally {
      setIsArchiving(false);
    }
  }

  function toggleRow(rowId: string) {
    setSelectedRowIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  }

  function selectAllRows() {
    setSelectedRowIds(selectableRows.map((row) => row.batchRowId as string));
  }

  function clearSelectedRows() {
    setSelectedRowIds([]);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-bold text-brand-700">슈퍼관리자 전용</p>
            <h2 className="mt-1 text-2xl font-black text-ink-950">엑셀 일괄등록과 비노출 처리</h2>
            <p className="mt-2 text-sm font-semibold text-ink-700">
              등록 전 검증과 미리보기를 거친 뒤 정상 행만 선택해서 등록합니다.
            </p>
          </div>
          <a
            href={BULK_DIRECTIVE_TEMPLATE_PATH}
            download={BULK_DIRECTIVE_TEMPLATE_FILE_NAME}
            className="inline-flex h-12 items-center justify-center rounded-[22px] border border-brand-100 bg-brand-50 px-5 text-sm font-bold text-brand-900 shadow-[0_12px_28px_rgba(7,32,63,0.08)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            엑셀 양식 다운로드
          </a>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "h-11 rounded-full border px-5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
                  active
                    ? "border-brand-900 bg-brand-900 text-white shadow-[0_14px_30px_rgba(7,32,63,0.18)]"
                    : "border-brand-100 bg-white text-brand-900 hover:-translate-y-0.5 hover:bg-brand-50",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {message || error ? (
        <div
          className={cn(
            "rounded-[24px] border px-5 py-4 text-sm font-bold",
            error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {error ?? message}
        </div>
      ) : null}

      {activeTab === "upload" ? (
        <section className="rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)] sm:p-6">
          <form onSubmit={handlePreview} className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label className="flex-1" htmlFor="bulk-directive-file">
              <span className="text-sm font-bold text-ink-800">엑셀 파일 업로드</span>
              <span className="mt-2 flex h-12 w-full items-center justify-between gap-3 rounded-[22px] border border-brand-100 bg-brand-50 px-4 text-sm font-semibold text-ink-900">
                <span className="truncate">{file?.name ?? "파일을 선택해주세요"}</span>
                <span className="rounded-full bg-brand-900 px-4 py-2 text-sm font-bold text-white">파일 선택</span>
              </span>
              <input id="bulk-directive-file" type="file" accept=".xlsx,.csv" onChange={handleFileChange} className="sr-only" />
            </label>
            <Button type="submit" isLoading={isPreviewing} loadingLabel="검증 중입니다">
              업로드 검증
            </Button>
          </form>

          {preview ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[22px] bg-ink-950 p-4 text-white">
                  <p className="text-sm font-bold text-white/75">전체 행</p>
                  <p className="mt-2 text-3xl font-black">{preview.totalRows}</p>
                </div>
                <div className="rounded-[22px] bg-emerald-50 p-4 text-emerald-800">
                  <p className="text-sm font-bold">등록 가능</p>
                  <p className="mt-2 text-3xl font-black">{preview.validRows}</p>
                </div>
                <div className="rounded-[22px] bg-rose-50 p-4 text-rose-700">
                  <p className="text-sm font-bold">수정 필요</p>
                  <p className="mt-2 text-3xl font-black">{preview.invalidRows}</p>
                </div>
                <div className="rounded-[22px] bg-brand-50 p-4 text-brand-900">
                  <p className="text-sm font-bold">선택 행</p>
                  <p className="mt-2 text-3xl font-black">{selectedCount}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={selectAllRows}>
                  전체 선택
                </Button>
                <Button type="button" variant="ghost" onClick={clearSelectedRows}>
                  선택 해제
                </Button>
                <Button
                  type="button"
                  onClick={handleRegisterSelected}
                  isLoading={isRegistering}
                  loadingLabel="등록 중입니다"
                >
                  선택한 지시사항 등록
                </Button>
              </div>

              <p className="text-sm font-semibold text-ink-700">오류가 있는 행은 등록할 수 없습니다.</p>
              <div className="overflow-x-auto rounded-[24px] border border-brand-100">
                <table className="min-w-[76rem] w-full border-collapse bg-white text-left text-sm">
                  <thead className="bg-brand-50 text-xs font-black text-brand-900">
                    <tr>
                      <th className="px-4 py-3">선택</th>
                      <th className="px-4 py-3">행번호</th>
                      <th className="px-4 py-3">지시사항</th>
                      <th className="px-4 py-3">담당부서</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3">긴급</th>
                      <th className="px-4 py-3">마감일</th>
                      <th className="px-4 py-3">오류</th>
                      <th className="px-4 py-3">등록여부</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-50">
                    {preview.rows.map((row) => {
                      const rowId = row.batchRowId ?? "";
                      const selected = rowId ? selectedRowIds.includes(rowId) : false;

                      return (
                        <tr key={`${row.rowNumber}-${row.title}`} className={row.valid ? "bg-white" : "bg-rose-50/70"}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!row.valid || !rowId}
                              onChange={() => toggleRow(rowId)}
                              aria-label={`${row.rowNumber}행 선택`}
                              className="h-5 w-5 rounded border-brand-200"
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-ink-900">{row.rowNumber}</td>
                          <td className="max-w-[24rem] px-4 py-3">
                            <p className="truncate font-bold text-ink-950">{row.title}</p>
                          </td>
                          <td className="px-4 py-3 text-ink-700">{row.departments.join(", ") || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-black text-brand-800">
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">{row.isUrgent ? "긴급" : "일반"}</td>
                          <td className="px-4 py-3">{row.dueDate ?? "-"}</td>
                          <td className="max-w-[20rem] px-4 py-3 text-rose-700">
                            <p className="truncate font-semibold">{row.errors.join(", ") || "-"}</p>
                          </td>
                          <td className="px-4 py-3 font-bold">{row.valid ? "등록 가능" : "수정 필요"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "replace" ? (
        <section className="space-y-5 rounded-[30px] border border-amber-200 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)] sm:p-6">
          <div>
            <p className="text-sm font-black text-amber-700">운영 데이터 교체</p>
            <h2 className="mt-1 text-xl font-black text-ink-950">지시사항 전체 교체</h2>
            <div className="mt-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              <p>기존 지시사항은 화면에서 모두 숨겨지고, 엑셀 데이터로 새로 등록됩니다.</p>
              <p className="mt-1">실제 데이터는 삭제되지 않으며 개발자가 복구할 수 있습니다.</p>
            </div>
          </div>

          <form onSubmit={handleReplacePreview} className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label className="flex-1" htmlFor="bulk-directive-replace-file">
              <span className="text-sm font-bold text-ink-800">전체 교체 엑셀 업로드</span>
              <span className="mt-2 flex h-12 w-full items-center justify-between gap-3 rounded-[22px] border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-ink-900">
                <span className="truncate">{replaceFile?.name ?? "통합 지시사항 시트가 있는 파일을 선택해주세요"}</span>
                <span className="rounded-full bg-amber-700 px-4 py-2 text-sm font-bold text-white">파일 선택</span>
              </span>
              <input
                id="bulk-directive-replace-file"
                type="file"
                accept=".xlsx"
                onChange={handleReplaceFileChange}
                className="sr-only"
              />
            </label>
            <Button type="submit" variant="secondary" isLoading={isReplacePreviewing} loadingLabel="검증 중입니다">
              검증하기
            </Button>
          </form>

          {replacePreview ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[22px] bg-ink-950 p-4 text-white">
                  <p className="text-sm font-bold text-white/75">기존 활성 지시사항</p>
                  <p className="mt-2 text-3xl font-black">{replacePreview.activeDirectivesCount ?? 0}</p>
                </div>
                <div className="rounded-[22px] bg-brand-50 p-4 text-brand-900">
                  <p className="text-sm font-bold">엑셀 등록 예정</p>
                  <p className="mt-2 text-3xl font-black">{replacePreview.totalRows}</p>
                </div>
                <div className="rounded-[22px] bg-rose-50 p-4 text-rose-700">
                  <p className="text-sm font-bold">오류</p>
                  <p className="mt-2 text-3xl font-black">{replacePreview.invalidRows}</p>
                </div>
                <div className="rounded-[22px] bg-emerald-50 p-4 text-emerald-800">
                  <p className="text-sm font-bold">등록 가능</p>
                  <p className="mt-2 text-3xl font-black">{replacePreview.validRows}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[24px] border border-brand-100">
                <table className="min-w-[88rem] w-full border-collapse bg-white text-left text-sm">
                  <thead className="bg-brand-50 text-xs font-black text-brand-900">
                    <tr>
                      <th className="px-4 py-3">행번호</th>
                      <th className="px-4 py-3">관리번호 예정</th>
                      <th className="px-4 py-3">회의일</th>
                      <th className="px-4 py-3">주관</th>
                      <th className="px-4 py-3">지시사항</th>
                      <th className="px-4 py-3">담당부서</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3">기한</th>
                      <th className="px-4 py-3">오류</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-50">
                    {replacePreview.rows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.directiveNo ?? row.title}`} className={row.valid ? "bg-white" : "bg-rose-50/70"}>
                        <td className="px-4 py-3 font-bold text-ink-900">{row.rowNumber}</td>
                        <td className="px-4 py-3 font-black text-brand-900">{row.directiveNo ?? "-"}</td>
                        <td className="px-4 py-3">{row.meetingDate}</td>
                        <td className="px-4 py-3">{row.chairRole ?? "-"}</td>
                        <td className="max-w-[28rem] px-4 py-3">
                          <p className="truncate font-bold text-ink-950">{row.title}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-700">{row.departments.join(", ") || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-black text-brand-800">
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.dueDate ?? "-"}</td>
                        <td className="max-w-[24rem] px-4 py-3 text-rose-700">
                          <p className="truncate font-semibold">{row.errors.join(", ") || row.warnings?.join(", ") || "-"}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                <label htmlFor="replace-confirm-text" className="text-sm font-bold text-ink-900">
                  실행하려면 전체교체를 입력해주세요
                </label>
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <input
                    id="replace-confirm-text"
                    value={replaceConfirmText}
                    onChange={(event) => setReplaceConfirmText(event.target.value)}
                    placeholder="전체교체"
                    className="h-12 flex-1 rounded-[22px] border border-amber-200 bg-white px-4 text-sm font-semibold text-ink-900"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleReplaceRegister}
                    disabled={replacePreview.invalidRows > 0 || replaceConfirmText.trim() !== "전체교체"}
                    isLoading={isReplacing}
                    loadingLabel="교체 중입니다"
                  >
                    기존 지시사항 비노출 후 등록
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "history" ? (
        <BatchList
          batches={batches}
          archiveReason={archiveReason}
          isArchiving={isArchiving}
          onArchive={(batchId) => handleArchiveBatch(batchId)}
          onReasonChange={setArchiveReason}
        />
      ) : null}

      {activeTab === "archive" ? (
        <section className="rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)] sm:p-6">
          <h2 className="text-xl font-black text-ink-950">일괄 비노출</h2>
          <p className="mt-2 text-sm font-semibold text-ink-700">
            실제 데이터는 삭제되지 않으며, 화면에서만 숨김 처리합니다.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <label>
              <span className="text-sm font-bold text-ink-800">등록 내역 선택</span>
              <select
                value={archiveBatchId}
                onChange={(event) => setArchiveBatchId(event.target.value)}
                className="mt-2 h-12 w-full rounded-[22px] border border-brand-100 bg-brand-50 px-4 text-sm font-semibold text-ink-900"
              >
                <option value="">선택해주세요</option>
                {batches
                  .filter((batch) => batch.registeredCount > 0)
                  .map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.fileName} · {formatDateTimeLabel(batch.createdAt)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-bold text-ink-800">비노출 사유</span>
              <input
                value={archiveReason}
                onChange={(event) => setArchiveReason(event.target.value)}
                placeholder="비노출 사유를 입력해주세요"
                className="mt-2 h-12 w-full rounded-[22px] border border-brand-100 bg-white px-4 text-sm font-semibold text-ink-900"
              />
            </label>
          </div>
          <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            <p>선택한 지시사항을 화면에서 숨기겠습니까?</p>
            <p className="mt-1">실제 데이터는 삭제되지 않으며 개발자가 복구할 수 있습니다.</p>
          </div>
          <div className="mt-5">
            <Button
              type="button"
              variant="danger"
              onClick={() => handleArchiveBatch()}
              isLoading={isArchiving}
              loadingLabel="처리 중입니다"
            >
              일괄 비노출
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BatchList({
  archiveReason,
  batches,
  isArchiving,
  onArchive,
  onReasonChange,
}: {
  archiveReason: string;
  batches: BulkDirectiveBatchItem[];
  isArchiving: boolean;
  onArchive: (batchId: string) => void;
  onReasonChange: (reason: string) => void;
}) {
  return (
    <section className="rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)] sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-ink-950">등록 내역</h2>
          <p className="mt-2 text-sm font-semibold text-ink-700">검증과 등록 처리된 묶음을 확인합니다.</p>
        </div>
        <label className="min-w-[280px]">
          <span className="text-sm font-bold text-ink-800">비노출 사유</span>
          <input
            value={archiveReason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="비노출 사유를 입력해주세요"
            className="mt-2 h-11 w-full rounded-[20px] border border-brand-100 bg-white px-4 text-sm font-semibold text-ink-900"
          />
        </label>
      </div>

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-brand-100">
        <table className="min-w-[70rem] w-full border-collapse bg-white text-left text-sm">
          <thead className="bg-brand-50 text-xs font-black text-brand-900">
            <tr>
              <th className="px-4 py-3">등록일</th>
              <th className="px-4 py-3">파일명</th>
              <th className="px-4 py-3">총 행</th>
              <th className="px-4 py-3">등록 건수</th>
              <th className="px-4 py-3">등록자</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">상세</th>
              <th className="px-4 py-3">일괄 비노출</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm font-bold text-ink-600">
                  등록 내역이 없습니다.
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="px-4 py-3 font-semibold text-ink-900">{formatDateTimeLabel(batch.createdAt)}</td>
                  <td className="max-w-[18rem] px-4 py-3">
                    <p className="truncate font-bold text-ink-950">{batch.fileName}</p>
                  </td>
                  <td className="px-4 py-3">{batch.totalRows}</td>
                  <td className="px-4 py-3">{batch.registeredCount}</td>
                  <td className="px-4 py-3">{batch.createdByName ?? "등록자 미확인"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full border px-3 py-1 text-xs font-black", statusBadgeClass(batch.status))}>
                      {BULK_DIRECTIVE_STATUS_BADGE_LABELS[batch.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    정상 {batch.validRows}건 · 수정 필요 {batch.invalidRows}건 · {formatDate(batch.registeredAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={batch.registeredCount === 0 || batch.status === "CANCELED"}
                      onClick={() => onArchive(batch.id)}
                      isLoading={isArchiving}
                      loadingLabel="처리 중"
                    >
                      일괄 비노출
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
