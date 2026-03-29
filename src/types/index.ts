export type AppSection = "login" | "dashboard" | "directives" | "reports";

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface PlaceholderApiResponse {
  resource: string;
  status: "ok" | "pending";
  message: string;
}
