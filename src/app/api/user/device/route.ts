import { getCurrentSession } from "@/features/auth";
import { registerUserDevice, registerUserDeviceSchema } from "@/features/notifications";
import { createApiErrorResponse, createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const body = await readJsonBody(request);
    const parsed = registerUserDeviceSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "디바이스 정보를 다시 확인해주세요.",
        parsed.error.flatten(),
        "USER_DEVICE_INVALID",
      );
    }

    const result = await registerUserDevice({
      ...parsed.data,
      pushToken: parsed.data.pushToken ?? null,
      session,
    });

    return createApiSuccessResponse({
      device: result,
      message: "디바이스 정보가 저장되었습니다.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
