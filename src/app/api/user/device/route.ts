import { requireCurrentSession } from "@/features/auth";
import { registerUserDevice, registerUserDeviceSchema } from "@/features/activity";
import { createApiSuccessResponse, handleApiError, readJsonBody } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
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

    const result = await registerUserDevice(session, {
      deviceKey: parsed.data.deviceKey,
      deviceType: parsed.data.deviceType,
      notificationPermission: parsed.data.notificationPermission,
      platform: parsed.data.platform,
      pushToken: parsed.data.pushToken ?? null,
    });

    return createApiSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
