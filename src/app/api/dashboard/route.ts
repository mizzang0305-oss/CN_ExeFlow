import { getCurrentSession } from "@/features/auth";
import { getDashboardData } from "@/features/dashboard";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const data = await getDashboardData(session);
    return Response.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
