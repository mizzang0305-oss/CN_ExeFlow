import "server-only";

import type { AppSession } from "@/features/auth/types";
import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

import type {
  DeveloperErrorLogInput,
  DeveloperErrorLogItem,
  DeveloperErrorLogUpdateInput,
  DeveloperErrorStatus,
} from "./types";

type DeveloperErrorLogRow = {
  app_state: Record<string, unknown> | null;
  browser_info: Record<string, unknown> | null;
  created_at: string;
  id: string;
  level: string;
  message: string;
  resolution_note: string | null;
  resolved_at: string | null;
  route_path: string | null;
  screenshot_data: string | null;
  screenshot_url: string | null;
  source: string;
  stack: string | null;
  status: string;
  user_email: string | null;
  user_id: string | null;
  user_role: string | null;
};

const DEVELOPER_ERROR_SELECT = `
  id,
  level,
  source,
  message,
  stack,
  route_path,
  user_id,
  user_email,
  user_role,
  browser_info,
  app_state,
  screenshot_url,
  screenshot_data,
  status,
  resolution_note,
  resolved_at,
  created_at
`;

function assertSuperAdmin(session: AppSession) {
  if (session.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "접근 권한이 없습니다.", null, "DEVELOPER_ACCESS_DENIED");
  }
}

function normalizeStatus(value: unknown): DeveloperErrorStatus {
  if (value === "IN_PROGRESS" || value === "RESOLVED") {
    return value;
  }

  return "OPEN";
}

function compactText(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value : fallback;
  return text.trim().slice(0, 4000);
}

function compactRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toDeveloperErrorLogItem(row: DeveloperErrorLogRow): DeveloperErrorLogItem {
  return {
    appState: row.app_state ?? {},
    browserInfo: row.browser_info ?? {},
    createdAt: row.created_at,
    id: row.id,
    level: row.level,
    message: row.message,
    resolutionNote: row.resolution_note,
    resolvedAt: row.resolved_at,
    routePath: row.route_path,
    screenshotData: row.screenshot_data,
    screenshotUrl: row.screenshot_url,
    source: row.source,
    stack: row.stack,
    status: normalizeStatus(row.status),
    userEmail: row.user_email,
    userId: row.user_id,
    userRole: row.user_role,
  };
}

export async function createDeveloperErrorLog(
  input: DeveloperErrorLogInput,
  session: AppSession | null,
) {
  const message = compactText(input.message, "오류 메시지 없음");

  if (!message) {
    throw new ApiError(400, "오류 메시지가 필요합니다.", null, "DEVELOPER_ERROR_MESSAGE_REQUIRED");
  }

  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("developer_error_logs")
    .insert({
      app_state: compactRecord(input.appState),
      browser_info: compactRecord(input.browserInfo),
      level: compactText(input.level, "ERROR") || "ERROR",
      message,
      route_path: input.routePath ? compactText(input.routePath) : null,
      screenshot_data: input.screenshotData ? compactText(input.screenshotData) : null,
      screenshot_url: input.screenshotUrl ? compactText(input.screenshotUrl) : null,
      source: compactText(input.source, "CLIENT") || "CLIENT",
      stack: input.stack ? compactText(input.stack) : null,
      user_email: session?.email ?? null,
      user_id: session?.userId ?? null,
      user_role: session?.role ?? null,
    })
    .select(DEVELOPER_ERROR_SELECT)
    .single<DeveloperErrorLogRow>();

  if (error) {
    throw new ApiError(500, "오류 로그를 저장하지 못했습니다.", error, "DEVELOPER_ERROR_LOG_CREATE_FAILED");
  }

  return toDeveloperErrorLogItem(data);
}

export async function listDeveloperErrorLogsAsSession(session: AppSession) {
  assertSuperAdmin(session);

  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("developer_error_logs")
    .select(DEVELOPER_ERROR_SELECT)
    .order("created_at", { ascending: false })
    .limit(150)
    .returns<DeveloperErrorLogRow[]>();

  if (error) {
    throw new ApiError(500, "오류 로그 목록을 불러오지 못했습니다.", error, "DEVELOPER_ERROR_LOGS_LOAD_FAILED");
  }

  return (data ?? []).map(toDeveloperErrorLogItem);
}

export async function updateDeveloperErrorLogAsSession(
  session: AppSession,
  logId: string,
  input: DeveloperErrorLogUpdateInput,
) {
  assertSuperAdmin(session);

  const status = normalizeStatus(input.status);
  const resolutionNote = input.resolutionNote ? compactText(input.resolutionNote) : null;
  const updatePayload = {
    resolution_note: resolutionNote,
    resolved_at: status === "RESOLVED" ? new Date().toISOString() : null,
    resolved_by: status === "RESOLVED" ? session.userId : null,
    status,
  };
  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("developer_error_logs")
    .update(updatePayload)
    .eq("id", logId)
    .select(DEVELOPER_ERROR_SELECT)
    .single<DeveloperErrorLogRow>();

  if (error) {
    throw new ApiError(500, "오류 로그를 수정하지 못했습니다.", error, "DEVELOPER_ERROR_LOG_UPDATE_FAILED");
  }

  return toDeveloperErrorLogItem(data);
}
