import { StatusPill } from "@/components/ui/status-pill";

const highlights = [
  {
    label: "역할별 진입",
    value: "권한에 맞는 화면으로 안내",
  },
  {
    label: "실행 가시성",
    value: "승인과 실행을 한 흐름으로 확인",
  },
  {
    label: "일일 통제",
    value: "부서별 진행 상황을 안정적으로 파악",
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
              <p className="text-xs text-white/62">대표 실행 통제</p>
            </div>
          </div>
          <StatusPill tone="muted">실행 현황 미리보기</StatusPill>
        </div>

        <div className="max-w-2xl space-y-5">
          <p className="text-xs font-semibold text-brand-100/82">경영진 로그인 경험</p>
          <h1 className="max-w-2xl text-4xl font-semibold text-white sm:text-[3.35rem] sm:leading-[1.08]">
            로그인 이후 지시, 실행, 승인 흐름을 한 화면에서 통제합니다.
          </h1>
          <p className="max-w-xl text-sm leading-7 text-white/74 sm:text-base">
            CN EXEFLOW는 대표 지시부터 부서 실행, 행동 증빙, 완료 요청, 승인과 결산까지
            매일 확인해야 할 실행 정보를 차분하게 연결합니다.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-5 backdrop-blur-xl"
            >
              <p className="text-[11px] font-semibold text-brand-100/78">{item.label}</p>
              <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
