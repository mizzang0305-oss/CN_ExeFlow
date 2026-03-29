export type AppSection = "login" | "dashboard" | "directives" | "reports";

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface ApiErrorShape {
  code: string;
  detail?: string | null;
  message: string;
  traceId?: string;
}

export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

export interface ApiFailureResponse {
  ok: false;
  error: ApiErrorShape;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

export interface PlaceholderApiResponse {
  resource: string;
  status: "ok" | "pending";
  message: string;
}
