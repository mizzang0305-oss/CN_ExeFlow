import { StatusPill } from "@/components/ui/status-pill";

const highlights = [
  {
    label: "Role-aware entry",
    value: "Secure login routing",
  },
  {
    label: "Operational clarity",
    value: "Approvals and execution in one flow",
  },
  {
    label: "Daily control",
    value: "Stable visibility across teams",
  },
] as const;

export function BrandPanel() {
  return (
    <section className="relative min-h-[360px] overflow-hidden rounded-[36px] border border-white/10 bg-[#04101d] text-white shadow-[0_38px_120px_rgba(2,8,18,0.45)] sm:min-h-[420px] xl:min-h-[720px]">
      <div className="absolute inset-0 motion-reduce:hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          className="h-full w-full object-cover"
        >
          <source src="/login-dashboard-loop.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_top_right,rgba(47,130,237,0.22),transparent_24%),linear-gradient(145deg,#04101d,#0b2544_58%,#123d6d)] motion-reduce:block" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(1,5,12,0.28),rgba(1,5,12,0.62)_34%,rgba(1,5,12,0.84)_68%,rgba(1,5,12,0.92)),linear-gradient(120deg,rgba(2,8,18,0.82),rgba(2,8,18,0.36)_42%,rgba(2,8,18,0.82)),radial-gradient(circle_at_top_right,rgba(47,130,237,0.2),transparent_24%)]" />
      <div className="brand-grid absolute inset-0 opacity-[0.08]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-100/75 to-transparent" />

      <div className="relative flex h-full flex-col justify-between gap-10 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/14 bg-white/12 text-sm font-bold tracking-[0.24em] text-white shadow-[0_18px_36px_rgba(0,0,0,0.22)] backdrop-blur-md">
              CN
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[0.3em] text-brand-100">CN EXEFLOW</p>
              <p className="text-xs text-white/62">Executive workflow control</p>
            </div>
          </div>
          <StatusPill tone="muted">Brand motion preview</StatusPill>
        </div>

        <div className="max-w-2xl space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-brand-100/82">
            Premium login experience
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-[3.35rem] sm:leading-[1.02]">
            Move from sign-in to execution with one calm, connected command surface.
          </h1>
          <p className="max-w-xl text-sm leading-7 text-white/74 sm:text-base">
            CN EXEFLOW brings authentication, workspace context, approvals, and execution visibility
            into a single steady experience designed for daily operational flow.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-5 backdrop-blur-xl"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-brand-100/78">
                {item.label}
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
