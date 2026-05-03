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

  async function handleCreateMeeting(event: FormEvent<HTMLFormElement>) {
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

      const response = await fetch("/api/meetings", {
        body: formData,
        method: "POST",
      });
      const meeting = await readApiResponse<MeetingRecordItem>(response);

      setTitle("");
      setContent("");
      setFile(null);
      setMessage("회의록이 저장되었습니다.");
      await refreshMeetings(meeting.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "회의록을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAnalyzeMeeting() {
    if (!selectedMeeting) {
      setError("분석할 회의록을 선택해주세요.");
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
      setError(caughtError instanceof Error ? caughtError.message : "회의내용 분석을 완료하지 못했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleRegisterDirectives() {
    if (!selectedMeeting) {
      setError("등록할 회의록을 선택해주세요.");
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="space-y-4 rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
        <div>
          <h2 className="text-2xl font-bold text-ink-950">신규 회의 생성</h2>
          <p className="mt-2 text-sm font-semibold text-ink-700">회의 내용을 저장한 뒤 지시 후보를 분석합니다.</p>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleCreateMeeting(event)}>
          <FieldGroup>
            <FieldLabel label="제목" required />
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </FieldGroup>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldGroup>
              <FieldLabel label="회의 유형" required />
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
            <FieldLabel label="내용" required />
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

          <Button type="submit" isLoading={isSaving} loadingLabel="저장 중">
            저장
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-ink-950">회의내용 분석</h2>
            <p className="mt-2 text-sm font-semibold text-ink-700">회의록을 선택하고 지시 후보를 확인합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void handleAnalyzeMeeting()} isLoading={isAnalyzing} loadingLabel="분석 중">
              회의내용 분석
            </Button>
            <Button type="button" onClick={() => void handleRegisterDirectives()} isLoading={isRegistering} loadingLabel="등록 중">
              부서별 자동 등록
            </Button>
          </div>
        </div>

        <FieldGroup>
          <FieldLabel label="회의록 선택" />
          <Select value={selectedMeetingId} onChange={(event) => setSelectedMeetingId(event.target.value)}>
            {meetings.length === 0 ? <option value="">저장된 회의록 없음</option> : null}
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
              <p className="mt-2 text-sm font-semibold text-ink-600">회의내용 분석을 실행하면 미리보기 목록이 표시됩니다.</p>
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
  );
}
