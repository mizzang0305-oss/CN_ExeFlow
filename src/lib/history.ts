import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { JsonObject } from "@/types";

import { ApiError } from "./errors";

type HistoryRecordInput = {
  action: string;
  actorId: string;
  afterData?: unknown;
  beforeData?: unknown;
  entityId: string;
  entityType: string;
  metadata?: JsonObject;
};

function canFallbackToAuditLogs(error: PostgrestError) {
  return error.code === "42P01" || error.code === "42703";
}

export async function recordHistory(
  client: SupabaseClient,
  input: HistoryRecordInput,
) {
  const payload = {
    afterData: input.afterData ?? null,
    beforeData: input.beforeData ?? null,
    metadata: input.metadata ?? {},
  };

  const historyInsert = await client.from("history").insert({
    action: input.action,
    actor_id: input.actorId,
    created_at: new Date().toISOString(),
    entity_id: input.entityId,
    entity_type: input.entityType,
    id: crypto.randomUUID(),
    payload,
  });

  if (!historyInsert.error) {
    return;
  }

  if (!canFallbackToAuditLogs(historyInsert.error)) {
    throw new ApiError(500, "Failed to record history.", historyInsert.error);
  }

  const auditInsert = await client.from("audit_logs").insert({
    acted_at: new Date().toISOString(),
    acted_by: input.actorId,
    action: input.action,
    after_data: payload,
    before_data: input.beforeData ?? null,
    entity_id: input.entityId,
    entity_type: input.entityType,
    id: crypto.randomUUID(),
  });

  if (auditInsert.error) {
    throw new ApiError(500, "Failed to record history.", {
      auditError: auditInsert.error,
      historyError: historyInsert.error,
    });
  }
}
