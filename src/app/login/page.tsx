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
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#020814,#081425_56%,#0d1d31)] py-6 sm:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(47,130,237,0.14),transparent_22%),radial-gradient(circle_at_92%_18%,rgba(29,99,179,0.12),transparent_24%)]" />
      <div className="brand-grid absolute inset-0 opacity-[0.06]" />

      <div className="app-container relative flex min-h-screen items-center">
        <div className="grid w-full items-stretch gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="order-2 xl:order-1">
            <BrandPanel />
          </div>

          <div className="order-1 relative flex items-center xl:order-2">
            <div className="absolute inset-0 rounded-[36px] border border-white/8 bg-white/6 shadow-[0_32px_80px_rgba(0,0,0,0.24)] backdrop-blur-sm" />
            <div className="relative flex w-full items-center p-3 sm:p-4 lg:p-6">
              <LoginForm bootstrapData={bootstrapData} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
