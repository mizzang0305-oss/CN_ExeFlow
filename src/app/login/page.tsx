import { redirect } from "next/navigation";

import { LoginForm } from "@/components";
import { BrandPanel } from "@/components/auth/brand-panel";
import { getCurrentSession, getDefaultAppRoute, getInitialSetupBootstrapData } from "@/features/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect(getDefaultAppRoute(session.role));
  }

  const bootstrapData = await getInitialSetupBootstrapData();

  return (
    <main className="relative min-h-screen overflow-hidden py-8 sm:py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(20,73,133,0.14),transparent_24%),radial-gradient(circle_at_90%_18%,rgba(47,130,237,0.12),transparent_24%)]" />
      <div className="brand-grid absolute inset-0 opacity-20" />

      <div className="app-container relative">
        <div className="grid w-full gap-6 xl:grid-cols-[1.12fr_0.88fr] xl:items-stretch">
          <BrandPanel />

          <div className="panel-strong flex items-center p-4 sm:p-6">
            <LoginForm bootstrapData={bootstrapData} />
          </div>
        </div>
      </div>
    </main>
  );
}
