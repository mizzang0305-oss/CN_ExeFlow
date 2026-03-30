import { redirect } from "next/navigation";

import { getDefaultAppRoute, requireCurrentSession } from "@/features/auth";

export const dynamic = "force-dynamic";

export default async function DashboardEntryPage() {
  const session = await requireCurrentSession();
  redirect(getDefaultAppRoute(session.role));
}
