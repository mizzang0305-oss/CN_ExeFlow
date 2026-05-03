import { getCurrentSession } from "@/features/auth";
import {
  softDeleteMeetingRecordAsSession,
  updateMeetingRecordAsSession,
  type MeetingType,
} from "@/features/meetings";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type MeetingRouteContext = {
  params: Promise<{
    meetingId: string;
  }>;
};

function normalizeMeetingType(value: FormDataEntryValue | null): MeetingType {
  if (value === "ADMIN" || value === "SAFETY" || value === "TF" || value === "ETC") {
    return value;
  }

  return "ETC";
}

export async function PATCH(request: Request, context: MeetingRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { meetingId } = await context.params;
    const formData = await request.formData();
    const fileValue = formData.get("file");
    const meeting = await updateMeetingRecordAsSession(
      session,
      meetingId,
      {
        content: String(formData.get("content") ?? ""),
        meetingDate: String(formData.get("meetingDate") ?? ""),
        meetingType: normalizeMeetingType(formData.get("meetingType")),
        title: String(formData.get("title") ?? ""),
      },
      fileValue instanceof File && fileValue.size > 0 ? fileValue : null,
    );

    return createApiSuccessResponse(meeting);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: MeetingRouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const { meetingId } = await context.params;
    const meeting = await softDeleteMeetingRecordAsSession(session, meetingId);
    return createApiSuccessResponse(meeting);
  } catch (error) {
    return handleApiError(error);
  }
}
