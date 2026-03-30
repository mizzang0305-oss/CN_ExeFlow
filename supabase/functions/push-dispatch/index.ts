import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type DispatchRequestBody = {
  notificationLogId?: string;
  notificationLogIds?: string[];
};

type NotificationLogRow = {
  body: string;
  channel: string;
  delivery_status: string;
  directive_id: string | null;
  id: string;
  notification_type: string;
  payload: Record<string, unknown> | null;
  title: string;
  user_id: string;
};

type UserDeviceRow = {
  device_key: string;
  device_type: string;
  id: string;
  notification_permission: string;
  platform: string;
  push_token: string | null;
  user_id: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase Edge Function 환경 변수가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}

function normalizeNotificationIds(body: DispatchRequestBody) {
  const ids = [
    ...(body.notificationLogId ? [body.notificationLogId] : []),
    ...(Array.isArray(body.notificationLogIds) ? body.notificationLogIds : []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(ids));
}

async function updateNotificationStatus(
  client: ReturnType<typeof createAdminClient>,
  notificationId: string,
  values: Partial<NotificationLogRow>,
) {
  const { error } = await client.from("notification_logs").update(values).eq("id", notificationId);

  if (error) {
    throw error;
  }
}

async function loadNotificationLog(client: ReturnType<typeof createAdminClient>, notificationId: string) {
  const { data, error } = await client
    .from("notification_logs")
    .select("id, user_id, directive_id, notification_type, channel, title, body, delivery_status, payload")
    .eq("id", notificationId)
    .maybeSingle<NotificationLogRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function loadPushDevices(client: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await client
    .from("user_devices")
    .select("id, user_id, device_key, platform, device_type, push_token, notification_permission")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("notification_permission", "granted")
    .not("push_token", "is", null);

  if (error) {
    throw error;
  }

  return ((data ?? []) as UserDeviceRow[]).filter(
    (device) => !!device.push_token && !device.push_token.startsWith("preview-web-push:"),
  );
}

async function dispatchToProvider(notification: NotificationLogRow, devices: UserDeviceRow[]) {
  const pushWebhookUrl = Deno.env.get("PUSH_PROVIDER_WEBHOOK_URL");
  const pushWebhookSecret = Deno.env.get("PUSH_PROVIDER_WEBHOOK_SECRET");

  if (!pushWebhookUrl) {
    return {
      ok: false,
      reason: "missing_push_webhook",
    } as const;
  }

  const response = await fetch(pushWebhookUrl, {
    body: JSON.stringify({
      body: notification.body,
      channel: notification.channel,
      devices: devices.map((device) => ({
        deviceKey: device.device_key,
        deviceType: device.device_type,
        platform: device.platform,
        pushToken: device.push_token,
      })),
      directiveId: notification.directive_id,
      notificationLogId: notification.id,
      notificationType: notification.notification_type,
      payload: notification.payload ?? {},
      title: notification.title,
    }),
    headers: {
      "Content-Type": "application/json",
      ...(pushWebhookSecret ? { "X-Push-Webhook-Secret": pushWebhookSecret } : {}),
    },
    method: "POST",
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: `provider_http_${response.status}`,
    } as const;
  }

  return { ok: true } as const;
}

async function dispatchSingleNotification(client: ReturnType<typeof createAdminClient>, notificationId: string) {
  const notification = await loadNotificationLog(client, notificationId);

  if (!notification) {
    return {
      notificationId,
      result: "not_found",
    } as const;
  }

  if (notification.channel !== "WEB_PUSH") {
    return {
      notificationId,
      result: "skip_non_web_push",
    } as const;
  }

  const devices = await loadPushDevices(client, notification.user_id);

  if (devices.length === 0) {
    await updateNotificationStatus(client, notification.id, {
      delivery_status: "FAILED",
      payload: {
        ...(notification.payload ?? {}),
        dispatchReason: "device_unavailable",
      },
    });

    return {
      notificationId,
      result: "device_unavailable",
    } as const;
  }

  const dispatchResult = await dispatchToProvider(notification, devices);

  if (!dispatchResult.ok) {
    await updateNotificationStatus(client, notification.id, {
      delivery_status: "FAILED",
      payload: {
        ...(notification.payload ?? {}),
        dispatchReason: dispatchResult.reason,
      },
    });

    return {
      notificationId,
      result: dispatchResult.reason,
    } as const;
  }

  await updateNotificationStatus(client, notification.id, {
    delivery_status: "SENT",
    payload: {
      ...(notification.payload ?? {}),
      dispatchedAt: new Date().toISOString(),
      dispatchedDeviceCount: devices.length,
    },
  });

  return {
    notificationId,
    result: "sent",
  } as const;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      error: "POST 요청만 허용됩니다.",
      ok: false,
    });
  }

  let body: DispatchRequestBody;

  try {
    body = (await request.json()) as DispatchRequestBody;
  } catch {
    return jsonResponse(400, {
      error: "요청 본문이 올바른 JSON 형식이 아닙니다.",
      ok: false,
    });
  }

  const notificationIds = normalizeNotificationIds(body);

  if (notificationIds.length === 0) {
    return jsonResponse(400, {
      error: "notificationLogId 또는 notificationLogIds가 필요합니다.",
      ok: false,
    });
  }

  try {
    const client = createAdminClient();
    const results = [];

    for (const notificationId of notificationIds) {
      results.push(await dispatchSingleNotification(client, notificationId));
    }

    return jsonResponse(200, {
      ok: true,
      results,
    });
  } catch (error) {
    console.error("[push-dispatch]", error);

    return jsonResponse(500, {
      error: "웹푸시 디스패치 처리 중 오류가 발생했습니다.",
      ok: false,
    });
  }
});
