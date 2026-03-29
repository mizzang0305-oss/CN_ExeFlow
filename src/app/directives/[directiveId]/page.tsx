import Link from "next/link";

import {
  AppFrame,
  AttachmentList,
  Badge,
  Button,
  Card,
  DirectiveStatusBadge,
  EmptyState,
  LogCard,
  SoftDeleteLogButton,
  UrgencyBadge,
  WorkflowActionPanel,
} from "@/components";
import { requireCurrentSession } from "@/features/auth";
import { getDirectiveDetailForSession } from "@/features/directives";
import { formatDateLabel, formatDateTimeLabel, formatRelativeUpdate } from "@/lib";

export const dynamic = "force-dynamic";

type DirectiveDetailPageProps = {
  params: Promise<{
    directiveId: string;
  }>;
};

export default async function DirectiveDetailPage({ params }: DirectiveDetailPageProps) {
  const session = await requireCurrentSession();
  const { directiveId } = await params;

  let directive: Awaited<ReturnType<typeof getDirectiveDetailForSession>> | null = null;
  let errorMessage: string | null = null;

  try {
    directive = await getDirectiveDetailForSession(session, directiveId);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "상세 정보를 불러오지 못했습니다.";
  }

  return (
    <AppFrame
      currentPath="/directives"
      session={session}
      title="지시사항 상세"
      description="상단에서 상태를 확인하고, 아래에서 실행 로그와 증빙을 바로 관리할 수 있습니다."
    >
      {errorMessage || !directive ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">지시사항을 불러오지 못했습니다</h2>
          <p className="text-sm text-danger-700">{errorMessage}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className={directive.isUrgent ? "border-danger-200" : undefined}>
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <UrgencyBadge isUrgent={directive.isUrgent} urgentLevel={directive.urgentLevel} />
                    <DirectiveStatusBadge status={directive.status} />
                    <Badge tone="muted">{directive.directiveNo}</Badge>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-ink-950">{directive.title}</h2>
                    <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-7 text-ink-700">
                      {directive.content}
                    </p>
                  </div>
                </div>

                {directive.workflow.canManageLogs ? (
                  <Link href={`/directives/${directive.id}/logs/new`}>
                    <Button size="lg">행동 등록</Button>
                  </Link>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["담당 부서", directive.ownerDepartmentName ?? "미지정"],
                  ["마감일", formatDateLabel(directive.dueDate)],
                  ["최근 업데이트", formatRelativeUpdate(directive.lastActivityAt)],
                  ["등록 시각", formatDateTimeLabel(directive.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-ink-100 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-ink-950">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-ink-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">실행 로그</p>
                  <p className="mt-2 text-2xl font-semibold text-ink-950">{directive.logCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-ink-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">증빙</p>
                  <p className="mt-2 text-2xl font-semibold text-ink-950">{directive.attachmentCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-ink-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">담당자</p>
                  <p className="mt-2 text-base font-semibold text-ink-950">
                    {directive.ownerUserName ?? "부서 중심 진행"}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <WorkflowActionPanel
            directiveId={directive.id}
            canApprove={directive.workflow.canApprove}
            canReject={directive.workflow.canReject}
            canRequestCompletion={directive.workflow.canRequestCompletion}
          />

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">행동 로그</h2>
                <p className="mt-1 text-sm text-ink-700">
                  현장 행동과 후속 조치를 시간 순서로 확인할 수 있습니다.
                </p>
              </div>
            </div>

            {directive.logs.length === 0 ? (
              <EmptyState
                title="등록된 행동 로그가 없습니다"
                description="현장 조치가 시작되면 첫 행동 로그부터 남겨 주세요."
                action={
                  directive.workflow.canManageLogs ? (
                    <Link href={`/directives/${directive.id}/logs/new`}>
                      <Button size="md">첫 로그 등록</Button>
                    </Link>
                  ) : null
                }
              />
            ) : (
              <div className="grid gap-4">
                {directive.logs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    actions={
                      directive.workflow.canManageLogs ? (
                        <div className="flex flex-col items-end gap-2">
                          <Link href={`/directives/${directive.id}/logs/${log.id}/edit`}>
                            <Button variant="secondary" size="sm">
                              수정
                            </Button>
                          </Link>
                          <SoftDeleteLogButton directiveId={directive.id} logId={log.id} />
                        </div>
                      ) : null
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="section-title">증빙</h2>
              <p className="mt-1 text-sm text-ink-700">
                사진과 문서를 함께 확인하면서 현장 실행 상태를 판단합니다.
              </p>
            </div>
            <AttachmentList attachments={directive.attachments} />
          </section>
        </div>
      )}
    </AppFrame>
  );
}
