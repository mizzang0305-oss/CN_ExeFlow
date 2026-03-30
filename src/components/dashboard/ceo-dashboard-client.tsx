"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

import type { CeoDashboardData, DashboardQueueItem } from "@/features/dashboard";
import { formatDateLabel } from "@/lib";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const CeoDashboardAnalysis = dynamic(
  () => import("./ceo-dashboard-analysis").then((module) => module.CeoDashboardAnalysis),
  {
    loading: () => (
      <Card className="space-y-3">
        <div className="h-5 w-32 rounded-full bg-ink-100" />
        <div className="h-10 rounded-[20px] bg-ink-100" />
        <div className="h-36 rounded-[24px] bg-ink-100" />
      </Card>
    ),
  },
);

type CeoDashboardClientProps = {
  data: CeoDashboardData;
};

function QueueSection({
  description,
  emptyDescription,
  emptyTitle,
  items,
  title,
  onSelect,
}: {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  items: DashboardQueueItem[];
  title: string;
  onSelect: (item: DashboardQueueItem) => void;
}) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="mt-1 text-sm text-ink-700">{description}</p>
      </div>

      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={`${title}-${item.directiveId}`}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full rounded-[24px] border border-ink-200/90 bg-white px-4 py-4 text-left transition hover:border-brand-300 hover:bg-brand-50/35"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.badgeTone}>{item.badgeText}</Badge>
                <Badge tone="muted">{item.directiveNo}</Badge>
              </div>
              <p className="mt-3 text-base font-semibold text-ink-950">{item.title}</p>
              <p className="mt-2 text-sm text-ink-700">{item.subtitle}</p>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function CeoDashboardClient({ data }: CeoDashboardClientProps) {
  const [selectedItem, setSelectedItem] = useState<DashboardQueueItem | null>(null);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.actionCards.map((card) => (
          <Link key={card.id} href={card.href} className="block">
            <Card className="h-full space-y-3 transition hover:border-brand-300 hover:bg-brand-50/35">
              <Badge tone={card.tone}>{card.label}</Badge>
              <p className="text-4xl font-semibold tracking-tight text-ink-950">{card.value}</p>
              <p className="text-sm leading-6 text-ink-700">{card.description}</p>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <QueueSection
          title="지금 승인"
          description="대표 결정을 기다리는 완료 요청입니다."
          emptyTitle="승인 대기 항목이 없습니다."
          emptyDescription="지금 바로 승인할 항목이 없으면 가장 먼저 이 영역이 비어 있어야 합니다."
          items={data.approveNowQueue}
          onSelect={setSelectedItem}
        />
        <QueueSection
          title="지금 리스크"
          description="지연, 반려, 증빙 부족 항목을 묶어서 보여줍니다."
          emptyTitle="즉시 개입할 리스크가 없습니다."
          emptyDescription="지연과 증빙 부족 항목이 없으면 운영 상태가 안정적입니다."
          items={data.riskNowQueue}
          onSelect={setSelectedItem}
        />
        <QueueSection
          title="오늘 확인"
          description="오늘 또는 임박한 마감 항목을 빠르게 점검합니다."
          emptyTitle="오늘 확인할 마감 항목이 없습니다."
          emptyDescription="오늘 안에 확인이 필요한 지시는 현재 없습니다."
          items={data.checkTodayQueue}
          onSelect={setSelectedItem}
        />
      </section>

      <CeoDashboardAnalysis
        departments={data.departments}
        latestReport={data.latestReport}
        recentActivity={data.recentActivity}
        reportSummaryCards={data.reportSummaryCards}
        weeklyTrend={data.weeklyTrend}
      />

      {selectedItem ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(3,19,38,0.34)] backdrop-blur-[2px]">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="패널 닫기"
            onClick={() => setSelectedItem(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-white/60 bg-white px-6 py-6 shadow-[0_32px_80px_rgba(3,19,38,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={selectedItem.badgeTone}>{selectedItem.badgeText}</Badge>
                  <Badge tone="muted">{selectedItem.directiveNo}</Badge>
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink-950">{selectedItem.title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-700">{selectedItem.subtitle}</p>
              </div>

              <button
                type="button"
                className="rounded-full bg-ink-100 px-3 py-2 text-sm font-semibold text-ink-700"
                onClick={() => setSelectedItem(null)}
              >
                닫기
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-ink-200/90 bg-ink-50/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">즉시 확인 포인트</p>
              <p className="mt-3 text-sm leading-6 text-ink-700">
                {selectedItem.dueDate
                  ? `마감일은 ${formatDateLabel(selectedItem.dueDate)}입니다. 현황을 열어 로그와 증빙을 먼저 확인한 뒤 승인 또는 보완 지시를 진행하세요.`
                  : "상세 화면에서 완료 요청 사유, 최근 로그, 증빙 자료를 확인한 뒤 승인 또는 보완 지시를 진행하세요."}
              </p>
            </div>

            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <Link href={selectedItem.href}>
                <Button size="lg">상세 화면 열기</Button>
              </Link>
              <Link href="/directives/approval-queue">
                <Button size="lg" variant="secondary">
                  승인 큐 열기
                </Button>
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
