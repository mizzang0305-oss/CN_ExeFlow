type LoadingOverlayProps = {
  message?: string;
  submessage?: string;
};

export function LoadingOverlay({
  message = "CN EXEFLOW 준비 중",
  submessage = "실행 흐름과 운영 지표를 불러오고 있습니다.",
}: LoadingOverlayProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,var(--color-brand-950),#0a274b)] px-4 text-white">
      <div className="brand-grid absolute inset-0 opacity-25" />
      <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="absolute bottom-[-8rem] right-[-4rem] h-80 w-80 rounded-full bg-brand-700/30 blur-3xl" />

      <div className="relative w-full max-w-md rounded-[36px] border border-white/12 bg-white/8 p-7 shadow-[0_32px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-[26px] bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))] shadow-[0_18px_36px_rgba(47,130,237,0.28)]">
              <div
                className="absolute inset-[-5px] rounded-[30px] border border-white/15"
                style={{ animation: "brand-pulse 2.4s ease-in-out infinite" }}
              />
              <span className="text-base font-bold tracking-[0.18em]">CN</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-brand-100">CN FOOD</p>
              <p className="text-xs text-white/70">Internal Execution Control</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight">{message}</p>
            <p className="text-sm leading-6 text-white/72">{submessage}</p>
          </div>

          <div className="space-y-3">
            <div className="loading-bar h-2 rounded-full bg-white/10">
              <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,var(--color-brand-500),#93c5fd)]" />
            </div>
            <div className="grid gap-2 text-xs text-white/62 sm:grid-cols-3">
              <span>대표 지시 수집</span>
              <span>현장 로그 동기화</span>
              <span>승인 흐름 정렬</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
