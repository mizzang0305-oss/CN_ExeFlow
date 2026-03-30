import type {
  ApiFailureResponse,
  ApiResponse,
  ApiSuccessResponse,
  JsonObject,
  PlaceholderApiResponse,
} from "@/types";

import { ApiError } from "./errors";

export function createPlaceholderResponse(resource: string): PlaceholderApiResponse {
  return {
    resource,
    status: "pending",
    message: "초기 API 스텁 상태입니다. 아직 비즈니스 로직이 연결되지 않았습니다.",
  };
}

function stringifyDetail(detail: unknown) {
  if (typeof detail === "string") {
    return detail;
  }

  if (detail == null) {
    return null;
  }

  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export function createApiSuccessResponse<T>(data: T, init?: ResponseInit) {
  return Response.json(
    {
      ok: true,
      data,
    } satisfies ApiSuccessResponse<T>,
    init,
  );
}

export function createApiErrorResponse(status: number, error: ApiFailureResponse["error"]) {
  return Response.json(
    {
      ok: false,
      error,
    } satisfies ApiFailureResponse,
    { status },
  );
}

export async function readJsonBody(
  request: Request,
  options?: { required?: boolean },
): Promise<JsonObject> {
  const required = options?.required ?? true;
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    if (!required) {
      return {};
    }

    throw new ApiError(400, "요청 본문이 비어 있습니다.", null, "REQUEST_BODY_REQUIRED");
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType && !contentType.includes("application/json")) {
    throw new ApiError(
      415,
      "JSON 형식으로 요청해주세요.",
      { contentType },
      "CONTENT_TYPE_INVALID",
    );
  }

  try {
    const parsedBody = JSON.parse(rawBody) as unknown;

    if (parsedBody === null || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      throw new ApiError(400, "JSON 객체 형식으로 요청해주세요.", null, "REQUEST_BODY_INVALID");
    }

    return parsedBody as JsonObject;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(400, "JSON 형식이 올바르지 않습니다.", null, "REQUEST_JSON_INVALID");
  }
}

export function handleApiError(error: unknown) {
  const traceId = crypto.randomUUID();

  if (error instanceof ApiError) {
    console.error(`[${traceId}] API error`, {
      code: error.code,
      details: error.details ?? null,
      message: error.message,
      status: error.status,
    });

    return createApiErrorResponse(error.status, {
      code: error.code,
      detail: stringifyDetail(error.details),
      message: error.message,
      traceId,
    });
  }

  console.error(`[${traceId}] Unhandled API error`, error);

  return createApiErrorResponse(500, {
    code: "INTERNAL_SERVER_ERROR",
    detail: stringifyDetail(error),
    message: "요청을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    traceId,
  });
}

export async function readApiResponse<T>(response: Response) {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    if (!payload.ok) {
      throw new ApiError(
        response.status || 500,
        payload.error.message,
        payload.error.detail ?? null,
        payload.error.code,
      );
    }

    throw new ApiError(response.status || 500, "요청을 처리하지 못했습니다.", null, "API_RESPONSE_INVALID");
  }

  return payload.data;
}
