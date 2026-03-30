import Image from "next/image";

type LoadingOverlayProps = {
  message?: string;
  submessage?: string;
  useGif?: boolean;
};

export function LoadingOverlay({
  message = "Preparing CN EXEFLOW",
  submessage = "We are loading the next workspace view.",
  useGif = false,
}: LoadingOverlayProps) {
  if (useGif) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#020814,#08192d_56%,#0d223d)] px-4 text-white"
      >
        <div className="brand-grid absolute inset-0 opacity-[0.07]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(47,130,237,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(20,73,133,0.16),transparent_34%)]" />

        <div className="relative w-full max-w-md rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] px-6 py-8 text-center shadow-[0_32px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:px-8 sm:py-10">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-100/70 to-transparent" />

          <div className="flex flex-col items-center gap-6">
            <div className="motion-reduce:hidden">
              <Image
                src="/cn_loader_text_fixed.gif"
                alt=""
                aria-hidden="true"
                width={700}
                height={820}
                priority
                unoptimized
                className="h-auto w-[180px] drop-shadow-[0_16px_32px_rgba(0,0,0,0.28)] sm:w-[220px]"
              />
            </div>

            <div className="hidden h-24 w-24 items-center justify-center rounded-[28px] border border-white/12 bg-white/10 text-2xl font-bold tracking-[0.28em] text-white shadow-[0_18px_36px_rgba(0,0,0,0.22)] motion-reduce:flex">
              CN
            </div>

            <div className="space-y-2 opacity-0 animate-[cn-loading-fade_240ms_ease_forwards]">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-brand-100/80">
                CN EXEFLOW
              </p>
              <p className="text-2xl font-semibold tracking-tight text-white">{message}</p>
              <p className="mx-auto max-w-sm text-sm leading-6 text-white/72">{submessage}</p>
            </div>
          </div>

          <span className="sr-only">
            {message}. {submessage}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,var(--color-brand-950),#0a274b)] px-4 text-white"
    >
      <div className="brand-grid absolute inset-0 opacity-24" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,130,237,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(20,73,133,0.18),transparent_32%)]" />

      <div className="relative w-full max-w-md rounded-[36px] border border-white/12 bg-white/8 p-7 shadow-[0_32px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex h-18 w-18 items-center justify-center">
              <div className="cn-loading-ring absolute inset-0 rounded-full border border-white/16" />
              <div className="cn-loading-ring cn-loading-ring--accent absolute inset-[5px] rounded-full border border-brand-200/65" />
              <div className="cn-loading-grid absolute inset-[9px] rounded-full" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))] shadow-[0_18px_36px_rgba(47,130,237,0.28)]">
                <span className="text-base font-bold tracking-[0.18em]">CN</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-brand-100">CN EXEFLOW</p>
              <p className="text-xs text-white/70">Executive workflow control</p>
            </div>
          </div>

          <div className="space-y-2 opacity-0 animate-[cn-loading-fade_240ms_ease_forwards]">
            <p className="text-2xl font-semibold tracking-tight">{message}</p>
            <p className="text-sm leading-6 text-white/72">{submessage}</p>
          </div>

          <div className="space-y-3">
            <div className="loading-bar h-2 rounded-full bg-white/10">
              <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,var(--color-brand-500),#93c5fd)]" />
            </div>
            <div className="grid gap-2 text-xs text-white/62 sm:grid-cols-3">
              <span>Session context</span>
              <span>Role routing</span>
              <span>Workspace sync</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
