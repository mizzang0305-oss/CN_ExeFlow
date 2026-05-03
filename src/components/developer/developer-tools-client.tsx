"use client";

import { useMemo, useState } from "react";

import type { DeveloperErrorLogItem, DeveloperErrorStatus } from "@/features/developer";
import { readApiResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";

type DeveloperToolsClientProps = {
  initialLogs: DeveloperErrorLogItem[];
};

type StatusFilter = "ALL" | "TODAY" | DeveloperErrorStatus;

const statusLabelMap: Record<DeveloperErrorStatus, string> = {
  IN_PROGRESS: "조치중",
  OPEN: "미조치",
  RESOLVED: "해결",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function isToday(value: string) {
  const target = new Date(value);
  const now = new Date();

  return target.getFullYear() === now.getFullYear()
    && target.getMonth() === now.getMonth()
    && target.getDate() === now.getDate();
}

export function DeveloperToolsClient({ initialLogs }: DeveloperToolsClientProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [selectedLogId, setSelectedLogId] = useState(initialLogs[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [resolutionNote, setResolutionNote] = useState(initialLogs[0]?.resolutionNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedLog = useMemo(
    () => logs.find((log) => log.id === selectedLogId) ?? logs[0] ?? null,
    [logs, selectedLogId],
  );
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (statusFilter === "TODAY" && !isToday(log.createdAt)) {
        return false;
      }

      if (statusFilter !== "ALL" && statusFilter !== "TODAY" && log.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [log.message, log.routePath, log.userEmail, log.source].some((value) =>
        (value ?? "").toLowerCase().includes(query),
      );
    });
  }, [logs, search, statusFilter]);

  async function updateLog(nextStatus: DeveloperErrorStatus) {
    if (!selectedLog) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/developer/error-logs/${selectedLog.id}`, {
        body: JSON.stringify({
          resolutionNote,
          status: nextStatus,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const updatedLog = await readApiResponse<DeveloperErrorLogItem>(response);
      setLogs((current) => current.map((log) => (log.id === updatedLog.id ? updatedLog : log)));
      setSelectedLogId(updatedLog.id);
      setResolutionNote(updatedLog.resolutionNote ?? "");
      setMessage(nextStatus === "RESOLVED" ? "해결 처리되었습니다." : "조치 메모가 저장되었습니다.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "오류 로그를 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function selectLog(log: DeveloperErrorLogItem) {
    setSelectedLogId(log.id);
    setResolutionNote(log.resolutionNote ?? "");
    setMessage(null);
    setError(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)]">
      <section className="space-y-4 rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-ink-950">오류 로그 목록</h2>
            <p className="mt-2 text-sm font-semibold text-ink-700">발생 경로와 사용자 정보를 기준으로 조치 상태를 관리합니다.</p>
          </div>
          <Input
            aria-label="검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="검색"
            className="w-full sm:w-64"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["ALL", "전체"],
            ["OPEN", "미조치"],
            ["IN_PROGRESS", "조치중"],
            ["RESOLVED", "해결"],
            ["TODAY", "오늘"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value as StatusFilter)}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-bold transition",
                statusFilter === value
                  ? "border-brand-900 bg-brand-900 text-white"
                  : "border-ink-100 bg-white text-ink-700 hover:border-brand-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-ink-100">
          <table className="min-w-[62rem] w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs font-bold text-ink-600">
              <tr>
                <th className="px-4 py-3">발생 시간</th>
                <th className="px-4 py-3">조치 상태</th>
                <th className="px-4 py-3">발생 경로</th>
                <th className="px-4 py-3">사용자 정보</th>
                <th className="px-4 py-3">오류 메시지</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-bold text-ink-600">
                    표시할 오류 로그가 없습니다.
                  </td>
                </tr>
              ) : null}
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className={cn(
                    "cursor-pointer transition",
                    selectedLog?.id === log.id ? "bg-brand-50" : "bg-white hover:bg-ink-50",
                  )}
                  onClick={() => selectLog(log)}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-ink-900">{formatDate(log.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-ink-700">
                    {statusLabelMap[log.status]}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-ink-700">{log.routePath ?? "경로 없음"}</td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-ink-700">{log.userEmail ?? "사용자 미확인"}</td>
                  <td className="max-w-[22rem] truncate px-4 py-3 font-bold text-ink-950">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="space-y-4 rounded-[30px] border border-brand-100 bg-white p-5 shadow-[0_24px_70px_rgba(6,18,38,0.1)]">
        <div>
          <p className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-900">상세 패널</p>
          <h2 className="mt-3 text-2xl font-bold text-ink-950">오류 상세</h2>
        </div>

        {selectedLog ? (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-bold text-ink-500">오류 메시지</dt>
                <dd className="mt-1 font-bold text-ink-950">{selectedLog.message}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink-500">발생 경로</dt>
                <dd className="mt-1 text-ink-800">{selectedLog.routePath ?? "경로 없음"}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink-500">브라우저 정보</dt>
                <dd className="mt-1 rounded-2xl bg-ink-50 p-3 text-xs text-ink-700">
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(selectedLog.browserInfo, null, 2)}</pre>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-500">화면 상태 정보</dt>
                <dd className="mt-1 rounded-2xl bg-ink-50 p-3 text-xs text-ink-700">
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(selectedLog.appState, null, 2)}</pre>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-500">스택 추적</dt>
                <dd className="mt-1 max-h-52 overflow-y-auto rounded-2xl bg-ink-950 p-3 text-xs text-white">
                  <pre className="whitespace-pre-wrap break-words">{selectedLog.stack ?? "기록 없음"}</pre>
                </dd>
              </div>
            </dl>

            <Textarea
              aria-label="조치 메모"
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="조치 메모"
              rows={4}
            />

            {message ? <div className="rounded-2xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700">{message}</div> : null}
            {error ? <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700">{error}</div> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" isLoading={isSaving} loadingLabel="저장 중" onClick={() => void updateLog("IN_PROGRESS")}>
                조치 메모 저장
              </Button>
              <Button type="button" isLoading={isSaving} loadingLabel="처리 중" onClick={() => void updateLog("RESOLVED")}>
                해결 처리
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-ink-100 bg-ink-50 px-5 py-8 text-center">
            <p className="font-bold text-ink-700">선택된 오류 로그가 없습니다.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
