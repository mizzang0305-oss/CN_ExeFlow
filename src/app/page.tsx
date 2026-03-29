import { redirect } from "next/navigation";

import { getCurrentSession, getDefaultAppRoute } from "@/features/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const session = await getCurrentSession();
    redirect(session ? getDefaultAppRoute(session.role) : "/login");
  } catch {
    redirect("/login");
  }
}
