import { getCurrentSession } from "@/features/auth";
import {
  createDirectiveAsSession,
  createDirectiveSchema,
  directiveListQuerySchema,
  listDirectivesForSession,
} from "@/features/directives";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
  handleApiError,
  readJsonBody,
} from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    const parsed = directiveListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (!parsed.success) {
      return createApiErrorResponse(400, {
        code: "DIRECTIVE_QUERY_INVALID",
        message: parsed.error.issues[0]?.message ?? "조회 조건이 올바르지 않습니다.",
      });
    }

    const result = await listDirectivesForSession(session, parsed.data);
    return createApiSuccessResponse(result);
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

    const body = await readJsonBody(request);
    const parsed = createDirectiveSchema.safeParse(body);

    if (!parsed.success) {
      return createApiErrorResponse(400, {
        code: "DIRECTIVE_CREATE_INVALID",
        message: parsed.error.issues[0]?.message ?? "지시 입력값이 올바르지 않습니다.",
      });
    }

    const result = await createDirectiveAsSession(session, parsed.data);
    return createApiSuccessResponse(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
