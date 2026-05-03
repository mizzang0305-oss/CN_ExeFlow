"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type {
  MeetingDepartmentOption,
  MeetingDraftItem,
  MeetingManagementData,
  MeetingRecordItem,
  MeetingType,
} from "@/features/meetings/types";
import { readApiResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";

const meetingTypeLabels: Record<MeetingType, string> = {
  ADMIN: "관리자 회의",
  ETC: "기타 회의",
  SAFETY: "안전 회의",
  TF: "TF 회의",
};

type DraftState = MeetingDraftItem & {
  selectedDepartmentIds: string[];
};

type MeetingSortOrder = "ASC" | "DESC";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function buildDraftState(drafts: MeetingDraftItem[]) {
  return drafts.map<DraftState>((draft) => ({
    ...draft,
    selectedDepartmentIds: [...draft.selectedDepartmentIds],
  }));
}

export function MeetingManagementClient({ initialData }: { initialData: MeetingManagementData }) {
  const [meetings, setMeetings] = useState(initialData.meetings);
  const [selectedMeetingId, setSelectedMeetingId] = useState(initialData.meetings[0]?.id ?? "");
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<MeetingType | "ALL">("ALL");
  const [meetingSortOrder, setMeetingSortOrder] = useState<MeetingSortOrder>("DESC");
  const [pendingDeleteMeetingId, setPendingDeleteMeetingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("ADMIN");
  const [meetingDate, setMeetingDate] = useState(todayValue());
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId],
  );
  const filteredMeetings = useMemo(() => {
    return meetings
      .filter((meeting) => meetingTypeFilter === "ALL" || meeting.meetingType === meetingTypeFilter)
      .toSorted((first, second) => {
        const firstTime = new Date(`${first.meetingDate}T00:00:00`).getTime();
        const secondTime = new Date(`${second.meetingDate}T00:00:00`).getTime();

        return meetingSortOrder === "DESC" ? secondTime - firstTime : firstTime - secondTime;
      });
  }, [meetingSortOrder, meetingTypeFilter, meetings]);
  const editingMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === editingMeetingId) ?? null,
    [editingMeetingId, meetings],
  );

  useEffect(() => {
    setDrafts(buildDraftState(selectedMeeting?.drafts ?? []));
  }, [selectedMeeting]);

  async function refreshMeetings(preferredMeetingId?: string) {
    const response = await fetch("/api/meetings", {
      headers: { Accept: "application/json" },
    });
    const data = await readApiResponse<MeetingManagementData>(response);
    setMeetings(data.meetings);
    setSelectedMeetingId(preferredMeetingId ?? data.meetings[0]?.id ?? "");
  }

  function resetMeetingForm() {
    setEditingMeetingId(null);
    setTitle("");
    setContent("");
    setMeetingType("ADMIN");
    setMeetingDate(todayValue());
    setFile(null);
  }

  function startEditMeeting(meeting: MeetingRecordItem) {
    setEditingMeetingId(meeting.id);
    setTitle(meeting.title);
    setContent(meeting.content);
    setMeetingType(meeting.meetingType);
    setMeetingDate(meeting.meetingDate);
    setFile(null);
    setSelectedMeetingId(meeting.id);
    setMessage("회의 수정 내용을 입력해주세요.");
    setError(null);
  }

  async function handleSaveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("meetingType", meetingType);
      formData.set("meetingDate", meetingDate);
      formData.set("content", content);

      if (file) {
        formData.set("file", file);
      }

      const response = await fetch(editingMeetingId ? `/api/meetings/${editingMeetingId}` : "/api/meetings", {
        body: formData,
        method: editingMeetingId ? "PATCH" : "POST",
      });
      const meeting = await readApiResponse<MeetingRecordItem>(response);

      resetMeetingForm();
      setMessage(editingMeetingId ? "회의가 수정되었습니다." : "회의가 저장되었습니다.");
      await refreshMeetings(meeting.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "회의를 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteMeeting() {
    if (!pendingDeleteMeetingId) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      await readApiResponse<MeetingRecordItem>(
        await fetch(`/api/meetings/${pendingDeleteMeetingId}`, {
          method: "DELETE",
        }),
      );

      if (editingMeetingId === pendingDeleteMeetingId) {
        resetMeetingForm();
      }

      setPendingDeleteMeetingId(null);
      setMessage("회의가 목록에서 숨김 처리되었습니다.");
      await refreshMeetings();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "회의를 목록에서 숨기지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAnalyzeMeeting() {
    if (!selectedMeeting) {
      setError("분석할 회의를 선택해주세요.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsAnalyzing(true);

    try {
      const response = await fetch(`/api/meetings/${selectedMeeting.id}/analyze`, {
        method: "POST",
      });
      const result = await readApiResponse<{ drafts: MeetingDraftItem[]; message: string }>(response);
      const nextMeetings = meetings.map((meeting) =>
        meeting.id === selectedMeeting.id ? { ...meeting, drafts: result.drafts } : meeting,
      );
      setMeetings(nextMeetings);
      setDrafts(buildDraftState(result.drafts));
      setMessage(result.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "회의 내용 분석을 완료하지 못했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleRegisterDirectives() {
    if (!selectedMeeting) {
      setError("등록할 회의를 선택해주세요.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsRegistering(true);

    try {
      const response = await fetch(`/api/meetings/${selectedMeeting.id}/register-directives`, {
        body: JSON.stringify({
          drafts: drafts.map((draft) => ({
            id: draft.id,
            isSelected: draft.isSelected,
            isUrgent: draft.isUrgent,
            selectedDepartmentIds: draft.selectedDepartmentIds,
          })),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await readApiResponse<{ createdDirectiveIds: string[]; message: string }>(response);
      setMessage(`${result.message} 등록 ${result.createdDirectiveIds.length}건`);
      await refreshMeetings(selectedMeeting.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "선택한 지시사항을 등록하지 못했습니다.");
    } finally {
      setIsRegistering(false);
    }
  }

  function updateDraft(draftId: string, updater: (draft: DraftState) => DraftState) {
    setDrafts((current) => current.map((draft) => (draft.id === draftId ? updater(draft) : draft)));
  }

  function toggleDraftDepartment(draft: DraftState, department: MeetingDepartmentOption) {
    const selected = new Set(draft.selectedDepartmentIds);

    if (selected.has(department.id)) {
      selected.delete(department.id);
    } else {
      selected.add(department.id);
    }

    updateDraft(draft.id, (current) => ({
      ...current,
      selectedDepartmentIds: Array.from(selected),
    }));
  }

  return (
    <div className="space-y-6">
      {pendingDeleteMeetingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_28px_80px_rgba(6,18,38,0.25)]">
            <h2 className="text-xl font-bold text-ink-950">회의를 목록에서 숨기겠습니까?</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-ink-700">
              실제 데이터는 삭제되지 않으며 개발자가 복구할 수 있습니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPendingDeleteMeetingId(null)}>
                취소
              </Button>
              <Button type="button" variant="danger" isLoading={isSaving} loadingLabel="처리 중" onClick={() => void handleDeleteMeeting()}>
                숨기기
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="space-y-4 rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
        <div>
          <h2 className="text-2xl font-bold text-ink-950">{editingMeeting ? "회의 수정" : "신규 회의 등록"}</h2>
          <p className="mt-2 text-sm font-semibold text-ink-700">회의 내용을 저장한 뒤 지시 후보를 분석합니다.</p>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSaveMeeting(event)}>
          <FieldGroup>
            <FieldLabel label="제목" required />
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </FieldGroup>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldGroup>
              <FieldLabel label="회의 구분" required />
              <Select value={meetingType} onChange={(event) => setMeetingType(event.target.value as MeetingType)}>
                {Object.entries(meetingTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="회의일" required />
              <Input type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} required />
            </FieldGroup>
          </div>

          <FieldGroup>
            <FieldLabel label="회의 내용" required />
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="회의 주요 내용과 조치 사항을 입력해주세요."
              rows={9}
              required
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="파일 업로드" />
            <Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </FieldGroup>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" isLoading={isSaving} loadingLabel="저장 중">
              {editingMeeting ? "수정 저장" : "저장"}
            </Button>
            {editingMeeting ? (
              <Button type="button" variant="secondary" onClick={resetMeetingForm}>
                취소
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-ink-950">지시사항 미리보기</h2>
            <p className="mt-2 text-sm font-semibold text-ink-700">회의를 선택하고 지시 후보를 확인합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void handleAnalyzeMeeting()} isLoading={isAnalyzing} loadingLabel="분석 중">
              회의 내용 분석
            </Button>
            <Button type="button" onClick={() => void handleRegisterDirectives()} isLoading={isRegistering} loadingLabel="등록 중">
              부서별 자동 등록
            </Button>
          </div>
        </div>

        <FieldGroup>
          <FieldLabel label="회의 목록" />
          <Select value={selectedMeetingId} onChange={(event) => setSelectedMeetingId(event.target.value)}>
            {meetings.length === 0 ? <option value="">등록된 회의 없음</option> : null}
            {meetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.meetingDate} · {meetingTypeLabels[meeting.meetingType]} · {meeting.title}
              </option>
            ))}
          </Select>
        </FieldGroup>

        {message ? <div className="rounded-2xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700">{error}</div> : null}

        <div className="space-y-3">
          {drafts.length === 0 ? (
            <div className="rounded-[24px] border border-ink-100 bg-ink-50 px-5 py-8 text-center">
              <p className="text-base font-bold text-ink-950">생성된 지시 후보가 없습니다.</p>
              <p className="mt-2 text-sm font-semibold text-ink-600">회의 내용 분석을 실행하면 미리보기 목록이 표시됩니다.</p>
            </div>
          ) : null}

          {drafts.map((draft) => (
            <div
              key={draft.id}
              className={cn(
                "rounded-[24px] border p-4 transition",
                draft.isSelected ? "border-brand-100 bg-brand-50/60" : "border-ink-100 bg-ink-50",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="flex min-h-11 flex-1 items-start gap-3 text-left">
                  <input
                    type="checkbox"
                    checked={draft.isSelected}
                    onChange={(event) =>
                      updateDraft(draft.id, (current) => ({ ...current, isSelected: event.target.checked }))
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-base font-bold text-ink-950">{draft.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-ink-700">{draft.content}</span>
                  </span>
                </label>

                <label className="inline-flex min-h-10 items-center gap-2 rounded-full border border-danger-100 bg-white px-3 py-1 text-sm font-bold text-danger-700">
                  <input
                    type="checkbox"
                    checked={draft.isUrgent}
                    onChange={(event) =>
                      updateDraft(draft.id, (current) => ({ ...current, isUrgent: event.target.checked }))
                    }
                  />
                  긴급
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {initialData.departments.map((department) => {
                  const active = draft.selectedDepartmentIds.includes(department.id);

                  return (
                    <button
                      key={department.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDraftDepartment(draft, department)}
                      className={cn(
                        "min-h-10 rounded-full border px-3 py-1 text-sm font-bold transition",
                        active
                          ? "border-brand-900 bg-brand-900 text-white"
                          : "border-ink-200 bg-white text-ink-700 hover:border-brand-300",
                      )}
                    >
                      {department.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      </div>

      <section className="space-y-4 rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-ink-950">회의 목록</h2>
            <p className="mt-2 text-sm font-semibold text-ink-700">회의일 기준으로 정렬하고 필요한 회의를 수정하거나 목록에서 숨깁니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="회의 구분 필터"
              value={meetingTypeFilter}
              onChange={(event) => setMeetingTypeFilter(event.target.value as MeetingType | "ALL")}
              className="min-h-11 w-40"
            >
              <option value="ALL">전체</option>
              {Object.entries(meetingTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <div className="flex rounded-full border border-ink-100 bg-ink-50 p-1">
              <button
                type="button"
                aria-pressed={meetingSortOrder === "DESC"}
                onClick={() => setMeetingSortOrder("DESC")}
                className={cn(
                  "min-h-10 rounded-full px-4 text-sm font-bold transition",
                  meetingSortOrder === "DESC" ? "bg-brand-900 text-white" : "text-ink-700 hover:bg-white",
                )}
              >
                최신순
              </button>
              <button
                type="button"
                aria-pressed={meetingSortOrder === "ASC"}
                onClick={() => setMeetingSortOrder("ASC")}
                className={cn(
                  "min-h-10 rounded-full px-4 text-sm font-bold transition",
                  meetingSortOrder === "ASC" ? "bg-brand-900 text-white" : "text-ink-700 hover:bg-white",
                )}
              >
                오래된순
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-ink-100">
          <table className="min-w-[58rem] w-full border-collapse text-left text-sm">
            <thead className="bg-ink-50 text-xs font-bold text-ink-600">
              <tr>
                <th className="px-4 py-3">회의일</th>
                <th className="px-4 py-3">회의 구분</th>
                <th className="px-4 py-3">제목</th>
                <th className="px-4 py-3">등록자</th>
                <th className="px-4 py-3">첨부</th>
                <th className="px-4 py-3">분석 상태</th>
                <th className="px-4 py-3">수정</th>
                <th className="px-4 py-3">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredMeetings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm font-bold text-ink-600">
                    표시할 회의가 없습니다.
                  </td>
                </tr>
              ) : null}
              {filteredMeetings.map((meeting) => {
                const selected = selectedMeetingId === meeting.id;
                const hasFile = Boolean(meeting.fileUrl || meeting.uploadedFileUrl);

                return (
                  <tr key={meeting.id} className={cn("transition", selected ? "bg-brand-50/70" : "bg-white hover:bg-ink-50")}>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-ink-900">{meeting.meetingDate}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-700">{meetingTypeLabels[meeting.meetingType]}</td>
                    <td className="max-w-[20rem] px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedMeetingId(meeting.id)}
                        className="block w-full truncate text-left font-bold text-ink-950 hover:text-brand-700"
                      >
                        {meeting.title}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-700">{meeting.createdByName ?? "등록자 미확인"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-ink-700">{hasFile ? "첨부 있음" : "없음"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-ink-700">
                      {meeting.drafts.length > 0 ? "분석 완료" : "분석 대기"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button type="button" size="sm" variant="secondary" onClick={() => startEditMeeting(meeting)}>
                        수정
                      </Button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button type="button" size="sm" variant="danger" onClick={() => setPendingDeleteMeetingId(meeting.id)}>
                        삭제
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
