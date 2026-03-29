import {
  createSessionFromUserSelection,
  getCurrentSession,
  getDefaultAppRoute,
  loginSelectionSchema,
} from "@/features/auth";
import { handleApiError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();

    return Response.json({
      data: session,
      redirectTo: session ? getDefaultAppRoute(session.role) : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = loginSelectionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "로그인 정보를 다시 확인해 주세요.",
        },
        { status: 400 },
      );
    }

    const result = await createSessionFromUserSelection(parsed.data);
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
