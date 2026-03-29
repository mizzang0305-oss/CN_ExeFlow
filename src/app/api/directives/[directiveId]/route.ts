import { getCurrentSession } from "@/features/auth";
import { getDirectiveDetailForSession } from "@/features/directives";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

type DirectiveRouteContext = {
  params: Promise<{
    directiveId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: DirectiveRouteContext,
) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { directiveId } = await context.params;
    const data = await getDirectiveDetailForSession(session, directiveId);
    return Response.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
