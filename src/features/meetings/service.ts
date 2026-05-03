import "server-only";

import type { AppSession } from "@/features/auth/types";
import { isAdminRole } from "@/features/auth/utils";
import { createDirectiveAsSession } from "@/features/directives";
import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase";
import { sanitizeFileName } from "@/lib/utils";

import type {
  MeetingDepartmentOption,
  MeetingDraftItem,
  MeetingManagementData,
  MeetingRecordItem,
  MeetingType,
} from "./types";

const MEETING_ATTACHMENT_BUCKET = "meeting-attachments";

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  ADMIN: "관리자 회의",
  ETC: "기타 회의",
  SAFETY: "안전 회의",
  TF: "TF 회의",
};

const directiveKeywords = [
  "해야 한다",
  "추진",
  "검토",
  "정리",
  "보고",
  "확인",
  "교육",
  "등록",
  "관리",
];

const departmentKeywordRules = [
  {
    departmentName: "영업본부",
    keywords: ["영업", "거래처", "샘플", "판매", "행사", "단가"],
  },
  {
    departmentName: "경영관리센터",
    keywords: ["채권", "인사", "총무", "시설", "소방", "회계", "안전점검"],
  },
  {
    departmentName: "구매물류부",
    keywords: ["구매", "물류", "재고", "출고", "배송", "발주"],
  },
  {
    departmentName: "공장총괄본부",
    keywords: ["공장", "생산", "HACCP", "육가공", "위생", "작업장"],
  },
];

const allDepartmentKeywords = ["전사", "전체", "관리자", "공통", "교육"];

type DepartmentRow = {
  id: string;
  name: string;
};

type MeetingRecordRow = {
  content: string;
  created_at: string;
  id: string;
  meeting_date: string;
  meeting_type: MeetingType;
  title: string;
  uploaded_file_url: string | null;
};

type MeetingDraftRow = {
  content: string;
  id: string;
  is_selected: boolean;
  is_urgent: boolean;
  recommended_departments: unknown;
  selected_department_ids: string[];
  status: string;
  title: string;
};

type DraftOverride = {
  id: string;
  isSelected: boolean;
  isUrgent: boolean;
  selectedDepartmentIds: string[];
};

function assertMeetingAdmin(session: AppSession) {
  if (!isAdminRole(session.role)) {
    throw new ApiError(403, "회의록 관리는 슈퍼관리자만 사용할 수 있습니다.", null, "MEETING_ADMIN_DENIED");
  }
}

function normalizeMeetingType(value: unknown): MeetingType {
  if (value === "ADMIN" || value === "SAFETY" || value === "TF" || value === "ETC") {
    return value;
  }

  return "ETC";
}

function toDraftItem(row: MeetingDraftRow): MeetingDraftItem {
  const recommendedDepartments = Array.isArray(row.recommended_departments)
    ? row.recommended_departments.filter((item): item is string => typeof item === "string")
    : [];

  return {
    content: row.content,
    id: row.id,
    isSelected: row.is_selected,
    isUrgent: row.is_urgent,
    recommendedDepartments,
    selectedDepartmentIds: row.selected_department_ids ?? [],
    status: row.status,
    title: row.title,
  };
}

function splitMeetingContent(content: string) {
  return content
    .split(/\n+|(?=\d+[.)]\s)|(?=-\s)/)
    .map((line) => line.replace(/^\d+[.)]\s*/, "").replace(/^-\s*/, "").trim())
    .filter((line) => line.length >= 8);
}

function hasDirectiveKeyword(line: string) {
  return directiveKeywords.some((keyword) => line.includes(keyword));
}

function buildDraftTitle(line: string) {
  const normalized = line.replace(/\s+/g, " ").trim();
  return normalized.length > 56 ? `${normalized.slice(0, 56)}...` : normalized;
}

function findDepartmentByName(departments: MeetingDepartmentOption[], name: string) {
  return departments.find((department) => department.name === name || department.name.includes(name)) ?? null;
}

function recommendDepartmentIds(line: string, departments: MeetingDepartmentOption[]) {
  const selected = new Set<string>();
  const recommendedNames = new Set<string>();

  if (allDepartmentKeywords.some((keyword) => line.includes(keyword))) {
    for (const department of departments) {
      selected.add(department.id);
      recommendedNames.add(department.name);
    }
  }

  for (const rule of departmentKeywordRules) {
    if (!rule.keywords.some((keyword) => line.includes(keyword))) {
      continue;
    }

    const department = findDepartmentByName(departments, rule.departmentName);

    if (department) {
      selected.add(department.id);
      recommendedNames.add(department.name);
    }
  }

  if (selected.size === 0) {
    for (const department of departments) {
      selected.add(department.id);
      recommendedNames.add(department.name);
    }
  }

  return {
    recommendedDepartments: Array.from(recommendedNames),
    selectedDepartmentIds: Array.from(selected),
  };
}

async function loadActiveDepartments(): Promise<MeetingDepartmentOption[]> {
  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("departments")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .returns<DepartmentRow[]>();

  if (error) {
    throw new ApiError(500, "부서 목록을 불러오지 못했습니다.", error, "MEETING_DEPARTMENTS_LOAD_FAILED");
  }

  return (data ?? []).map((department) => ({
    id: department.id,
    name: department.name,
  }));
}

async function uploadMeetingFile(file: File | null, meetingId: string) {
  if (!file || file.size === 0) {
    return null;
  }

  const client = createSupabaseServerClient();
  const safeName = sanitizeFileName(file.name || "meeting-file");
  const storagePath = `${meetingId}/${Date.now()}-${safeName}`;
  const { error } = await client.storage
    .from(MEETING_ATTACHMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (error) {
    throw new ApiError(500, "회의록 파일을 저장하지 못했습니다.", error, "MEETING_FILE_UPLOAD_FAILED");
  }

  return storagePath;
}

export function analyzeMeetingContent(content: string, departments: MeetingDepartmentOption[]) {
  const lines = splitMeetingContent(content);
  const candidates = lines.filter(hasDirectiveKeyword);
  const sourceLines = candidates.length > 0 ? candidates : lines.slice(0, 10);

  return sourceLines.map((line) => {
    const recommendation = recommendDepartmentIds(line, departments);

    return {
      content: line,
      isUrgent: line.includes("긴급") || line.includes("즉시"),
      recommendedDepartments: recommendation.recommendedDepartments,
      selectedDepartmentIds: recommendation.selectedDepartmentIds,
      title: buildDraftTitle(line),
    };
  });
}

export async function getMeetingManagementDataAsSession(session: AppSession): Promise<MeetingManagementData> {
  assertMeetingAdmin(session);

  const client = createSupabaseServerClient();
  const departments = await loadActiveDepartments();
  const { data: meetings, error: meetingError } = await client
    .from("meeting_records")
    .select("id, meeting_date, meeting_type, title, content, uploaded_file_url, created_at")
    .eq("is_deleted", false)
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12)
    .returns<MeetingRecordRow[]>();

  if (meetingError) {
    throw new ApiError(500, "회의록 목록을 불러오지 못했습니다.", meetingError, "MEETING_RECORDS_LOAD_FAILED");
  }

  const meetingIds = (meetings ?? []).map((meeting) => meeting.id);
  const draftsByMeetingId = new Map<string, MeetingDraftItem[]>();

  if (meetingIds.length > 0) {
    const { data: drafts, error: draftError } = await client
      .from("meeting_directive_drafts")
      .select("id, meeting_id, title, content, recommended_departments, selected_department_ids, status, is_selected, is_urgent")
      .in("meeting_id", meetingIds)
      .order("created_at", { ascending: true })
      .returns<Array<MeetingDraftRow & { meeting_id: string }>>();

    if (draftError) {
      throw new ApiError(500, "회의 지시 후보를 불러오지 못했습니다.", draftError, "MEETING_DRAFTS_LOAD_FAILED");
    }

    for (const draft of drafts ?? []) {
      const bucket = draftsByMeetingId.get(draft.meeting_id) ?? [];
      bucket.push(toDraftItem(draft));
      draftsByMeetingId.set(draft.meeting_id, bucket);
    }
  }

  return {
    departments,
    meetings: (meetings ?? []).map<MeetingRecordItem>((meeting) => ({
      content: meeting.content,
      createdAt: meeting.created_at,
      drafts: draftsByMeetingId.get(meeting.id) ?? [],
      id: meeting.id,
      meetingDate: meeting.meeting_date,
      meetingType: normalizeMeetingType(meeting.meeting_type),
      title: meeting.title,
      uploadedFileUrl: meeting.uploaded_file_url,
    })),
  };
}

export async function createMeetingRecordAsSession(
  session: AppSession,
  input: {
    content: string;
    meetingDate: string;
    meetingType: MeetingType;
    title: string;
  },
  file: File | null,
) {
  assertMeetingAdmin(session);

  const title = input.title.trim();
  const content = input.content.trim();

  if (title.length < 2 || content.length < 5) {
    throw new ApiError(400, "회의 제목과 내용을 입력해주세요.", null, "MEETING_RECORD_INVALID");
  }

  const client = createSupabaseServerClient();
  const meetingId = crypto.randomUUID();
  const uploadedFileUrl = await uploadMeetingFile(file, meetingId);
  const { data, error } = await client
    .from("meeting_records")
    .insert({
      content,
      created_by: session.userId,
      id: meetingId,
      meeting_date: input.meetingDate,
      meeting_type: input.meetingType,
      title,
      uploaded_file_url: uploadedFileUrl,
    })
    .select("id, meeting_date, meeting_type, title, content, uploaded_file_url, created_at")
    .single<MeetingRecordRow>();

  if (error) {
    throw new ApiError(500, "회의록을 저장하지 못했습니다.", error, "MEETING_RECORD_CREATE_FAILED");
  }

  await recordHistory(client, {
    action: "MEETING_RECORD_CREATED",
    actorId: session.userId,
    afterData: data,
    entityId: data.id,
    entityType: "meeting_record",
  });

  return data;
}

export async function analyzeMeetingAsSession(session: AppSession, meetingId: string) {
  assertMeetingAdmin(session);

  const client = createSupabaseServerClient();
  const departments = await loadActiveDepartments();
  const { data: meeting, error: meetingError } = await client
    .from("meeting_records")
    .select("id, content")
    .eq("id", meetingId)
    .eq("is_deleted", false)
    .maybeSingle<{ id: string; content: string }>();

  if (meetingError) {
    throw new ApiError(500, "회의록을 불러오지 못했습니다.", meetingError, "MEETING_RECORD_LOAD_FAILED");
  }

  if (!meeting) {
    throw new ApiError(404, "회의록을 찾을 수 없습니다.", null, "MEETING_RECORD_NOT_FOUND");
  }

  const drafts = analyzeMeetingContent(meeting.content, departments);

  await client.from("meeting_directive_drafts").delete().eq("meeting_id", meetingId);

  if (drafts.length === 0) {
    return [] as MeetingDraftItem[];
  }

  const { data, error } = await client
    .from("meeting_directive_drafts")
    .insert(
      drafts.map((draft) => ({
        content: draft.content,
        id: crypto.randomUUID(),
        is_selected: true,
        is_urgent: draft.isUrgent,
        meeting_id: meetingId,
        recommended_departments: draft.recommendedDepartments,
        selected_department_ids: draft.selectedDepartmentIds,
        title: draft.title,
        urgent_level: draft.isUrgent ? "HIGH" : null,
      })),
    )
    .select("id, title, content, recommended_departments, selected_department_ids, status, is_selected, is_urgent")
    .returns<MeetingDraftRow[]>();

  if (error) {
    throw new ApiError(500, "지시 후보를 저장하지 못했습니다.", error, "MEETING_DRAFT_CREATE_FAILED");
  }

  await recordHistory(client, {
    action: "MEETING_ANALYZED",
    actorId: session.userId,
    entityId: meetingId,
    entityType: "meeting_record",
    metadata: {
      draftCount: data?.length ?? 0,
    },
  });

  return (data ?? []).map(toDraftItem);
}

export async function registerSelectedMeetingDraftsAsSession(
  session: AppSession,
  input: {
    drafts: DraftOverride[];
    meetingId: string;
  },
) {
  assertMeetingAdmin(session);

  const client = createSupabaseServerClient();
  const departments = await loadActiveDepartments();
  const activeDepartmentIds = new Set(departments.map((department) => department.id));

  for (const draft of input.drafts) {
    const selectedDepartmentIds = draft.selectedDepartmentIds.filter((departmentId) =>
      activeDepartmentIds.has(departmentId),
    );

    const updateResult = await client
      .from("meeting_directive_drafts")
      .update({
        is_selected: draft.isSelected,
        is_urgent: draft.isUrgent,
        selected_department_ids: selectedDepartmentIds,
        updated_at: new Date().toISOString(),
        urgent_level: draft.isUrgent ? "HIGH" : null,
      })
      .eq("id", draft.id)
      .eq("meeting_id", input.meetingId);

    if (updateResult.error) {
      throw new ApiError(500, "지시 후보를 갱신하지 못했습니다.", updateResult.error, "MEETING_DRAFT_UPDATE_FAILED");
    }
  }

  const { data: selectedDrafts, error } = await client
    .from("meeting_directive_drafts")
    .select("id, title, content, recommended_departments, selected_department_ids, status, is_selected, is_urgent")
    .eq("meeting_id", input.meetingId)
    .eq("is_selected", true)
    .returns<MeetingDraftRow[]>();

  if (error) {
    throw new ApiError(500, "선택된 지시 후보를 불러오지 못했습니다.", error, "MEETING_SELECTED_DRAFTS_LOAD_FAILED");
  }

  const createdDirectiveIds: string[] = [];

  for (const draft of selectedDrafts ?? []) {
    const selectedDepartmentIds = (draft.selected_department_ids ?? []).filter((departmentId) =>
      activeDepartmentIds.has(departmentId),
    );
    const targetDepartmentIds = selectedDepartmentIds.length > 0
      ? selectedDepartmentIds
      : departments.map((department) => department.id);

    const directive = await createDirectiveAsSession(session, {
      content: `${draft.content}\n\n회의록 출처: ${input.meetingId}`,
      dueDate: null,
      isUrgent: draft.is_urgent,
      ownerUserId: null,
      primaryDepartmentId: targetDepartmentIds[0],
      selectedDepartmentIds: targetDepartmentIds,
      targetScope: targetDepartmentIds.length === departments.length ? "ALL" : "SELECTED",
      title: draft.title,
      urgentLevel: draft.is_urgent ? "HIGH" : null,
    });

    if (!directive) {
      throw new ApiError(500, "지시사항을 등록하지 못했습니다.", null, "MEETING_DIRECTIVE_CREATE_FAILED");
    }

    createdDirectiveIds.push(directive.id);

    const draftUpdate = await client
      .from("meeting_directive_drafts")
      .update({
        status: "REGISTERED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id);

    if (draftUpdate.error) {
      throw new ApiError(500, "지시 후보 등록 상태를 저장하지 못했습니다.", draftUpdate.error, "MEETING_DRAFT_STATUS_UPDATE_FAILED");
    }
  }

  await recordHistory(client, {
    action: "MEETING_DRAFTS_REGISTERED",
    actorId: session.userId,
    entityId: input.meetingId,
    entityType: "meeting_record",
    metadata: {
      createdDirectiveCount: createdDirectiveIds.length,
      createdDirectiveIds,
    },
  });

  return {
    createdDirectiveIds,
  };
}

export { MEETING_TYPE_LABELS };
