type LoadingOverlayProps = {
  message?: string;
  submessage?: string;
};

export function LoadingOverlay({
  message = "실행 현황을 불러오는 중",
  submessage = "지시 데이터를 정리하고 있습니다.",
}: LoadingOverlayProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,var(--color-brand-950),#0a274b)] px-4 text-white">
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
              <p className="text-sm font-semibold tracking-[0.18em] text-brand-100">CN FOOD</p>
              <p className="text-xs text-white/70">Executive Execution Control</p>
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
              <span>지시 데이터 정리</span>
              <span>승인 대기 분석</span>
              <span>실행 로그 동기화</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
