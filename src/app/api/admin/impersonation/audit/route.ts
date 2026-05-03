import { requireAdminApiSession } from "@/features/auth";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const allowedActions = new Set(["IMPERSONATION_STARTED", "IMPERSONATION_ENDED"]);

export async function POST(request: Request) {
  try {
    const session = await requireAdminApiSession();
    const body = await readJsonBody(request);
    const action = typeof body.action === "string" ? body.action : "";
    const impersonatedUserId = typeof body.impersonatedUserId === "string" ? body.impersonatedUserId : "";
    const impersonatedUserName = typeof body.impersonatedUserName === "string" ? body.impersonatedUserName : null;

    if (!allowedActions.has(action)) {
      throw new ApiError(400, "감사 기록 유형을 확인해주세요.", { action }, "IMPERSONATION_AUDIT_ACTION_INVALID");
    }

    if (!impersonatedUserId) {
      throw new ApiError(400, "대리 확인 사용자를 확인해주세요.", null, "IMPERSONATION_AUDIT_USER_REQUIRED");
    }

    const client = createSupabaseServerClient();
    await recordHistory(client, {
      action,
      actorId: session.userId,
      afterData: {
        impersonatedUserId,
        impersonatedUserName,
      },
      entityId: impersonatedUserId,
      entityType: "impersonation",
      metadata: {
        actorDisplayName: session.displayName,
        actorRole: session.role,
        mode: "사용자 화면 전환",
      },
    });

    return createApiSuccessResponse({ recorded: true });
  } catch (error) {
    return handleApiError(error);
  }
}
