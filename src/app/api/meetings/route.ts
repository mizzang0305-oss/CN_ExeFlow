import { getCurrentSession } from "@/features/auth";
import {
  createMeetingRecordAsSession,
  getMeetingManagementDataAsSession,
  type MeetingType,
} from "@/features/meetings";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError } from "@/lib/api";

export const runtime = "nodejs";

function normalizeMeetingType(value: FormDataEntryValue | null): MeetingType {
  if (value === "ADMIN" || value === "SAFETY" || value === "TF" || value === "ETC") {
    return value;
  }

  return "ETC";
}

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const data = await getMeetingManagementDataAsSession(session);
    return createApiSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");
    const meeting = await createMeetingRecordAsSession(
      session,
      {
        content: String(formData.get("content") ?? ""),
        meetingDate: String(formData.get("meetingDate") ?? ""),
        meetingType: normalizeMeetingType(formData.get("meetingType")),
        title: String(formData.get("title") ?? ""),
      },
      fileValue instanceof File && fileValue.size > 0 ? fileValue : null,
    );

    return createApiSuccessResponse(meeting, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
