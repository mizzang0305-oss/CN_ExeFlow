import type { SupabaseClient } from "@supabase/supabase-js";

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

function buildAuditPayload(input: HistoryRecordInput) {
  return {
    action: input.action,
    acted_at: new Date().toISOString(),
    acted_by: input.actorId,
    after_data: {
      current: input.afterData ?? null,
      metadata: input.metadata ?? {},
    },
    before_data: input.beforeData ?? null,
    entity_id: input.entityId,
    entity_type: input.entityType,
    id: crypto.randomUUID(),
  };
}

async function tryInsertHistoryTable(client: SupabaseClient, input: HistoryRecordInput) {
  const historyInsert = await client.from("history").insert({
    action: input.action,
    actor_id: input.actorId,
    created_at: new Date().toISOString(),
    entity_id: input.entityId,
    entity_type: input.entityType,
    id: crypto.randomUUID(),
    payload: {
      afterData: input.afterData ?? null,
      beforeData: input.beforeData ?? null,
      metadata: input.metadata ?? {},
    },
  });

  if (historyInsert.error) {
    console.warn("History table write skipped", historyInsert.error);
  }
}

export async function recordHistory(client: SupabaseClient, input: HistoryRecordInput) {
  const auditInsert = await client.from("audit_logs").insert(buildAuditPayload(input));

  if (auditInsert.error) {
    throw new ApiError(500, "변경 이력을 기록하지 못했습니다.", auditInsert.error, "AUDIT_LOG_WRITE_FAILED");
  }

  await tryInsertHistoryTable(client, input);
}
