import { auditUnauthorizedDashboardApiAccess, getCurrentSession } from "@/features/auth";
import { isAdminRole } from "@/features/auth/utils";
import type { DirectiveStatusValue } from "@/lib/constants/status-labels";
import { normalizeCeoDirectiveQuery } from "@/lib/constants/status-labels";
import { createApiErrorResponse, handleApiError } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

type DepartmentRow = {
  id: string;
  name: string;
};

type DirectiveListRow = {
  directive_id: string;
  directives:
    | {
        created_at: string;
        directive_no: string;
        id: string;
        is_urgent: boolean;
        status: DirectiveStatusValue;
        title: string;
        updated_at: string | null;
        urgent_level: string | null;
      }
    | Array<{
        created_at: string;
        directive_no: string;
        id: string;
        is_urgent: boolean;
        status: DirectiveStatusValue;
        title: string;
        updated_at: string | null;
        urgent_level: string | null;
      }>
    | null;
};

function getJoinedDirective(row: DirectiveListRow) {
  return Array.isArray(row.directives) ? row.directives[0] : row.directives;
}

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return createApiErrorResponse(401, {
        code: "AUTH_REQUIRED",
        message: "로그인이 필요합니다.",
      });
    }

    if (!isAdminRole(session.role)) {
      auditUnauthorizedDashboardApiAccess(session, "/api/ceo/directives", ["CEO", "SUPER_ADMIN"]);
      return createApiErrorResponse(403, {
        code: "CEO_DIRECTIVES_ACCESS_DENIED",
        message: "대표 지시사항은 대표와 슈퍼 관리자만 조회할 수 있습니다.",
      });
    }

    const query = normalizeCeoDirectiveQuery(new URL(request.url).searchParams);

    if (!query.departmentId) {
      throw new ApiError(400, "부서를 선택해주세요.", null, "CEO_DIRECTIVES_DEPARTMENT_REQUIRED");
    }

    const client = createSupabaseServerClient();
    const from = (query.page - 1) * query.limit;
    const to = from + query.limit;

    let directivesQuery = client
      .from("directive_departments")
      .select(
        `
          directive_id,
          directives!inner (
            id,
            directive_no,
            title,
            status,
            is_urgent,
            urgent_level,
            created_at,
            updated_at
          )
        `,
      )
      .eq("department_id", query.departmentId)
      .eq("directives.is_deleted", false);

    if (query.status) {
      directivesQuery = directivesQuery.eq("directives.status", query.status);
    }

    if (query.urgent) {
      directivesQuery = directivesQuery.eq("directives.is_urgent", true);
    }

    const [departmentResult, directiveResult] = await Promise.all([
      client
        .from("departments")
        .select("id, name")
        .eq("id", query.departmentId)
        .maybeSingle<DepartmentRow>(),
      directivesQuery
        .order("created_at", { ascending: false, referencedTable: "directives" })
        .range(from, to)
        .returns<DirectiveListRow[]>(),
    ]);

    if (departmentResult.error) {
      throw new ApiError(
        500,
        "부서 정보를 불러오지 못했습니다.",
        departmentResult.error,
        "CEO_DIRECTIVES_DEPARTMENT_LOAD_FAILED",
      );
    }

    if (!departmentResult.data) {
      throw new ApiError(404, "부서를 찾을 수 없습니다.", null, "CEO_DIRECTIVES_DEPARTMENT_NOT_FOUND");
    }

    if (directiveResult.error) {
      throw new ApiError(
        500,
        "지시사항을 불러오지 못했습니다.",
        directiveResult.error,
        "CEO_DIRECTIVES_LOAD_FAILED",
      );
    }

    const rows = (directiveResult.data ?? []) as DirectiveListRow[];
    const visibleRows = rows.slice(0, query.limit);

    return Response.json({
      department: {
        id: departmentResult.data.id,
        name: departmentResult.data.name,
      },
      filter: {
        status: query.status,
        urgent: query.urgent,
      },
      hasMore: rows.length > query.limit,
      items: visibleRows.flatMap((row) => {
        const directive = getJoinedDirective(row);

        if (!directive) {
          return [];
        }

        return [
          {
            created_at: directive.created_at,
            directive_no: directive.directive_no,
            id: directive.id,
            is_urgent: directive.is_urgent,
            status: directive.status,
            title: directive.title,
            updated_at: directive.updated_at,
            urgent_level: directive.urgent_level,
          },
        ];
      }),
      limit: query.limit,
      page: query.page,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
