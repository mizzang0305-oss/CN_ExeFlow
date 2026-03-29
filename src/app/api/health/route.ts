import { createPlaceholderResponse } from "@/lib/api";

export async function GET() {
  return Response.json({
    ...createPlaceholderResponse("health"),
    status: "ok",
  });
}
