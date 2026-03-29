import { StatusPill } from "@/components/ui/status-pill";

const executionSteps = [
  { title: "대표 지시", description: "우선순위를 정하고 실행 기준을 배포합니다." },
  { title: "현장 실행", description: "부서별 조치와 담당자 실행이 빠르게 이어집니다." },
  { title: "증빙 수집", description: "사진, 문서, 행동 로그를 하나의 흐름으로 모읍니다." },
  { title: "승인 판단", description: "대표와 부서장이 승인 대기와 리스크를 바로 확인합니다." },
  { title: "주간 결산", description: "주간 보고 성과와 지연 신호를 누적해 경영 판단 데이터로 바꿉니다." },
] as const;

const motifBars = [
  { label: "실행 배정", height: "58%" },
  { label: "증빙 정보", height: "72%" },
  { label: "승인 가시화", height: "88%" },
] as const;

export function BrandPanel() {
  return (
    <section className="scan-line relative min-h-[460px] overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(160deg,var(--color-brand-950),#0b2b52_48%,#144985)] p-6 text-white shadow-[0_38px_100px_rgba(3,19,38,0.26)] sm:p-8 lg:min-h-[720px] lg:p-10">
      <div className="brand-grid absolute inset-0 opacity-25" />
      <div className="absolute -left-16 top-14 h-64 w-64 rounded-full bg-brand-500/22 blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-brand-700/28 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-100/80 to-transparent" />

      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))] text-sm font-bold tracking-[0.18em] text-white shadow-[0_18px_34px_rgba(47,130,237,0.28)]">
              CN
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[0.24em] text-brand-100">씨엔푸드</p>
              <p className="text-xs text-white/62">실행 통제 플랫폼</p>
            </div>
            <StatusPill tone="muted">경영 판단 데이터 중심 운영</StatusPill>
          </div>

          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-[3.2rem] sm:leading-[1.08]">
              대표, 통제, 실행력이 한 화면에서 이어지는 CN FOOD 운영 허브
            </h1>
            <p className="max-w-2xl text-base leading-8 text-white/74">
              CN EXEFLOW는 단순 조회 화면이 아니라 대표 지시부터 현장 증빙, 승인 판단, 주간 결산까지 실행 데이터를
              누적하는 조직 실행 통제 시스템입니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[28px] border border-white/12 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-100/72">통제 흐름</p>
              <p className="mt-3 text-2xl font-semibold text-white">5단계</p>
              <p className="mt-2 text-sm leading-6 text-white/68">대표 지시부터 결산까지 같은 화면 흐름으로 통제합니다.</p>
            </div>
            <div className="rounded-[28px] border border-white/12 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-100/72">증빙 연결</p>
              <p className="mt-3 text-2xl font-semibold text-white">실시간 연계</p>
              <p className="mt-2 text-sm leading-6 text-white/68">부서별 실행 로그와 증빙을 승인 흐름으로 바로 연결합니다.</p>
            </div>
            <div className="rounded-[28px] border border-white/12 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-100/72">결산 축적</p>
              <p className="mt-3 text-2xl font-semibold text-white">주간 보고</p>
              <p className="mt-2 text-sm leading-6 text-white/68">운영 기록을 다음 판단으로 이어지는 결산 데이터로 만듭니다.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[30px] border border-white/12 bg-white/10 p-5 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-100/70">실행 흐름</p>
            <div className="mt-4 space-y-3">
              {executionSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-3 rounded-[22px] border border-white/8 bg-white/6 px-4 py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/64">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5 backdrop-blur-xl">
            <div className="brand-dots absolute inset-0 opacity-20" />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-100/70">운영 시선</p>
                <p className="mt-3 text-sm leading-7 text-white/68">
                  물류, 현장, 본사 판단이 하나의 축으로 이어지도록 운영 시선을 구성했습니다.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid h-44 grid-cols-3 items-end gap-3 rounded-[26px] border border-white/8 bg-white/6 px-4 pb-4 pt-8">
                  {motifBars.map((bar, index) => (
                    <div key={bar.label} className="space-y-3">
                      <div className="relative flex h-28 items-end rounded-[20px] bg-white/6 p-2">
                        <div
                          className="relative w-full rounded-[16px] bg-[linear-gradient(180deg,#93c5fd,var(--color-brand-500),var(--color-brand-700))]"
                          style={{ height: bar.height }}
                        >
                          <div
                            className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-white/30 bg-white/90"
                            style={{ animation: `brand-pulse ${1.8 + index * 0.3}s ease-in-out infinite` }}
                          />
                        </div>
                      </div>
                      <p className="text-center text-xs font-medium text-white/66">{bar.label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/6 px-4 py-4">
                  <p className="text-sm font-semibold text-white">대표 지시에서 실행과 증빙, 승인, 결산까지</p>
                  <p className="mt-2 text-sm leading-6 text-white/62">
                    로그인 이후 모든 화면이 같은 흐름 기준으로 정렬되도록 설계했습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
