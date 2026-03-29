import type { JsonObject, PlaceholderApiResponse } from "@/types";

import { ApiError } from "./errors";

export function createPlaceholderResponse(
  resource: string,
): PlaceholderApiResponse {
  return {
    resource,
    status: "pending",
    message: "Initial API route scaffold only. No business logic yet.",
  };
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

    throw new ApiError(400, "Request body is required.");
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType && !contentType.includes("application/json")) {
    throw new ApiError(415, "Content-Type must be application/json.");
  }

  try {
    const parsedBody = JSON.parse(rawBody) as unknown;

    if (
      parsedBody === null ||
      typeof parsedBody !== "object" ||
      Array.isArray(parsedBody)
    ) {
      throw new ApiError(400, "Request body must be a JSON object.");
    }

    return parsedBody as JsonObject;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(400, "Invalid JSON body.");
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: error.message,
        details: error.details ?? null,
      },
      { status: error.status },
    );
  }

  console.error("Unhandled API error", error);

  return Response.json(
    {
      error: "Internal server error.",
    },
    { status: 500 },
  );
}
