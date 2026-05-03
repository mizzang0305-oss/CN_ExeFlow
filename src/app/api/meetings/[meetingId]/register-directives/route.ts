import { getCurrentSession } from "@/features/auth";
import { registerSelectedMeetingDraftsAsSession } from "@/features/meetings";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
  handleApiError,
  readJsonBody,
} from "@/lib/api";

export const runtime = "nodejs";

type MeetingRegisterRouteContext = {
  params: Promise<{
    meetingId: string;
  }>;
};

type DraftPayload = {
  id?: unknown;
  isSelected?: unknown;
  isUrgent?: unknown;
  selectedDepartmentIds?: unknown;
};

function normalizeDraftPayload(value: DraftPayload) {
  return {
    id: typeof value.id === "string" ? value.id : "",
    isSelected: value.isSelected !== false,
    isUrgent: value.isUrgent === true,
    selectedDepartmentIds: Array.isArray(value.selectedDepartmentIds)
      ? value.selectedDepartmentIds.filter((departmentId): departmentId is string => typeof departmentId === "string")
      : [],
  };
}

export async function POST(request: Request, context: MeetingRegisterRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { meetingId } = await context.params;
    const body = await readJsonBody(request);
    const drafts = Array.isArray(body.drafts)
      ? body.drafts.map((draft) => normalizeDraftPayload(draft as DraftPayload)).filter((draft) => draft.id)
      : [];

    if (drafts.length === 0) {
      return createApiErrorResponse(400, {
        code: "MEETING_DRAFT_REQUIRED",
        message: "등록할 지시 후보를 선택해주세요.",
      });
    }

    const result = await registerSelectedMeetingDraftsAsSession(session, {
      drafts,
      meetingId,
    });

    return createApiSuccessResponse({
      ...result,
      message: "선택한 지시사항이 등록되었습니다.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
