const kpiPlaceholders = Array.from({ length: 7 }, (_, index) => index);
const departmentPlaceholders = Array.from({ length: 6 }, (_, index) => index);

export default function CeoDashboardLoading() {
  return (
    <main aria-label="대표 대시보드 준비 화면" className="app-container space-y-6 py-8">
      <section className="rounded-[30px] bg-ink-950 p-6 text-white shadow-[0_26px_70px_rgba(6,18,38,0.2)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-brand-100">대표 대시보드를 준비하고 있습니다</p>
            <h1 className="mt-2 text-3xl font-bold">지시 현황을 불러오는 중입니다</h1>
          </div>
          <span className="cn-loading-ring h-9 w-9 rounded-full border border-white/30" aria-hidden="true" />
        </div>
        <div className="loading-bar mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-white/70" />
        </div>
      </section>

      <section aria-label="요약 지표 준비 중" className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {kpiPlaceholders.map((item) => (
          <div key={item} className="rounded-[24px] border border-white/80 bg-white px-5 py-5 shadow-[0_18px_42px_rgba(6,18,38,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div className="executive-skeleton h-5 w-24 rounded-full" />
              <div className="executive-skeleton h-5 w-5 rounded-full" />
            </div>
            <div className="executive-skeleton mt-5 h-12 w-28 rounded-[18px]" />
          </div>
        ))}
      </section>

      <section aria-label="부서 카드 준비 중" className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {departmentPlaceholders.map((item) => (
          <div key={item} className="rounded-[26px] border border-white/80 bg-white p-5 shadow-[0_18px_46px_rgba(6,18,38,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="executive-skeleton h-7 w-36 rounded-full" />
                <div className="executive-skeleton mt-3 h-5 w-20 rounded-full" />
              </div>
              <div className="executive-skeleton h-8 w-16 rounded-full" />
            </div>

            <div className="mt-7 flex items-end justify-between gap-4">
              <div>
                <div className="executive-skeleton h-4 w-16 rounded-full" />
                <div className="executive-skeleton mt-3 h-14 w-24 rounded-[18px]" />
              </div>
              <div className="executive-skeleton h-12 w-20 rounded-[18px]" />
            </div>

            <div className="executive-skeleton mt-5 h-4 rounded-full" />
            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="executive-skeleton h-20 rounded-[18px]" />
              <div className="executive-skeleton h-20 rounded-[18px]" />
              <div className="executive-skeleton h-20 rounded-[18px]" />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
