import {
  createDirective,
  createDirectiveSchema,
  directiveListQuerySchema,
  listDirectivesForSession,
} from "@/features/directives";
import { getCurrentSession } from "@/features/auth";
import { handleApiError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const parsed = directiveListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "조회 조건이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const result = await listDirectivesForSession(session, parsed.data);

    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = createDirectiveSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "지시사항 입력값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const result = await createDirective(parsed.data);

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
