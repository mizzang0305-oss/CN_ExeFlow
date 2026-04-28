import { auditUnauthorizedDashboardApiAccess, getCurrentSession, type AppSession } from "@/features/auth";
import { isAdminRole } from "@/features/auth/utils";
import { listDirectivesForSession, type DirectiveListItem } from "@/features/directives";
import type { CeoDirectiveQuery, DirectiveStatusValue } from "@/lib/constants/status-labels";
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
  assigned_at: string | null;
  created_at: string;
  department_status: DirectiveStatusValue;
  directive_id: string;
  updated_at: string | null;
  directives:
    | {
        created_at: string;
        directive_no: string;
        id: string;
        is_urgent: boolean;
        title: string;
        urgent_level: string | number | null;
      }
    | Array<{
        created_at: string;
        directive_no: string;
        id: string;
        is_urgent: boolean;
        title: string;
        urgent_level: string | number | null;
      }>
    | null;
};

function getJoinedDirective(row: DirectiveListRow) {
  return Array.isArray(row.directives) ? row.directives[0] : row.directives;
}

function findDepartmentAssignment(item: DirectiveListItem, departmentId: string) {
  return item.assignedDepartments.find((assignment) => assignment.departmentId === departmentId) ?? null;
}

function mapFallbackItem(item: DirectiveListItem, departmentId: string) {
  const assignment = findDepartmentAssignment(item, departmentId);

  if (!assignment) {
    return null;
  }

  return {
    created_at: item.lastActivityAt,
    directive_no: item.directiveNo,
    id: item.id,
    is_urgent: item.isUrgent,
    status: assignment.departmentStatus,
    title: item.title,
    updated_at: item.lastActivityAt,
    urgent_level: item.urgentLevel,
  };
}

async function buildFallbackResponse({
  department,
  query,
  session,
}: {
  department: DepartmentRow | null;
  query: CeoDirectiveQuery;
  session: AppSession;
}) {
  const fallbackResult = await listDirectivesForSession(session, {
    page: 1,
    pageSize: 1000,
  });

  const filteredItems = fallbackResult.items.filter((item) => {
    const assignment = findDepartmentAssignment(item, query.departmentId);

    if (!assignment) {
      return false;
    }

    if (query.status && assignment.departmentStatus === query.status) {
      return query.urgent ? item.isUrgent : true;
    }

    if (query.status) {
      return false;
    }

    return query.urgent ? item.isUrgent : true;
  });

  const from = (query.page - 1) * query.limit;
  const visibleItems = filteredItems.slice(from, from + query.limit);
  const fallbackDepartmentName =
    department?.name ??
    filteredItems
      .map((item) => findDepartmentAssignment(item, query.departmentId)?.departmentName ?? null)
      .find((name): name is string => Boolean(name)) ??
    "선택한 부서";

  return Response.json({
    department: {
      id: query.departmentId,
      name: fallbackDepartmentName,
    },
    filter: {
      status: query.status,
      urgent: query.urgent,
    },
    hasMore: filteredItems.length > from + query.limit,
    items: visibleItems.flatMap((item) => {
      const mappedItem = mapFallbackItem(item, query.departmentId);

      return mappedItem ? [mappedItem] : [];
    }),
    limit: query.limit,
    page: query.page,
  });
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
          department_status,
          assigned_at,
          created_at,
          updated_at,
          directives!inner (
            id,
            directive_no,
            title,
            is_urgent,
            urgent_level,
            created_at
          )
        `,
      )
      .eq("department_id", query.departmentId)
      .eq("directives.is_archived", false);

    if (query.status) {
      directivesQuery = directivesQuery.eq("department_status", query.status);
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
        .order("created_at", { ascending: false })
        .range(from, to)
        .returns<DirectiveListRow[]>(),
    ]);

    if (departmentResult.error || directiveResult.error) {
      console.error("대표 지시사항 직접 조회 실패", {
        departmentError: departmentResult.error,
        directiveError: directiveResult.error,
      });

      try {
        return await buildFallbackResponse({
          department: departmentResult.data ?? null,
          query,
          session,
        });
      } catch (fallbackError) {
        throw new ApiError(
          500,
          "지시사항을 불러오지 못했습니다.",
          fallbackError,
          "CEO_DIRECTIVES_FALLBACK_LOAD_FAILED",
        );
      }
    }

    if (!departmentResult.data) {
      throw new ApiError(404, "부서를 찾을 수 없습니다.", null, "CEO_DIRECTIVES_DEPARTMENT_NOT_FOUND");
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
            status: row.department_status,
            title: directive.title,
            updated_at: row.updated_at ?? row.assigned_at ?? row.created_at,
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
