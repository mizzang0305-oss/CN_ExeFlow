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
      description="상위 지시 1건 아래에서 주관 부서와 협조 부서의 이행 상태를 함께 보고, 바로 행동 로그와 증빙으로 이어집니다."
    >
      {errorMessage || !directive ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-950">지시사항을 불러오지 못했습니다.</h2>
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
                    <Badge tone={directive.targetScope === "ALL" ? "default" : "muted"}>
                      {directive.targetScope === "ALL" ? "전사 대상" : `대상 부서 ${directive.targetDepartmentCount}곳`}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-ink-950">{directive.title}</h2>
                    <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-7 text-ink-700">
                      {directive.content}
                    </p>
                  </div>
                </div>

                {directive.workflow.canManageLogs ? (
                  <Link
                    href={`/directives/${directive.id}/logs/new${
                      directive.workflow.currentDepartmentId
                        ? `?departmentId=${directive.workflow.currentDepartmentId}`
                        : ""
                    }`}
                  >
                    <Button size="lg">행동 등록</Button>
                  </Link>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["주관 부서", directive.ownerDepartmentName ?? "미지정"],
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

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-ink-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">대상 부서</p>
                  <p className="mt-2 text-2xl font-semibold text-ink-950">{directive.targetDepartmentCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-ink-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">완료 부서</p>
                  <p className="mt-2 text-2xl font-semibold text-ink-950">{directive.departmentProgress.COMPLETED}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-ink-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">승인 대기</p>
                  <p className="mt-2 text-2xl font-semibold text-ink-950">
                    {directive.departmentProgress.COMPLETION_REQUESTED}
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-ink-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">행동 로그</p>
                  <p className="mt-2 text-2xl font-semibold text-ink-950">{directive.logCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-ink-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">증빙</p>
                  <p className="mt-2 text-2xl font-semibold text-ink-950">{directive.attachmentCount}</p>
                </div>
              </div>
            </div>
          </Card>

          <section className="space-y-4">
            <div>
              <h2 className="section-title">부서별 이행 현황</h2>
              <p className="mt-1 text-sm text-ink-700">
                주관 부서와 협조 부서의 실제 상태를 따로 관리하고, 상위 지시 상태는 여기서 다시 집계됩니다.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {directive.departments.map((department) => {
                const canManageDepartmentLogs =
                  directive.workflow.canManageLogs &&
                  (directive.workflow.canManageMultipleDepartments || department.isCurrentDepartment);
                const canApproveDepartment =
                  directive.workflow.canManageMultipleDepartments &&
                  department.departmentStatus === "COMPLETION_REQUESTED";

                return (
                  <Card key={department.departmentId} className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <DirectiveStatusBadge status={department.departmentStatus} />
                          <Badge tone={department.isPrimary ? "default" : "muted"}>
                            {department.isPrimary ? "주관 부서" : "협조 부서"}
                          </Badge>
                          {department.isCurrentDepartment ? <Badge tone="muted">내 부서</Badge> : null}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-ink-950">
                            {department.departmentName ?? "부서 미지정"}
                          </h3>
                          <p className="mt-1 text-sm text-ink-600">
                            부서장 {department.departmentHeadName ?? "미지정"}
                            {department.departmentCode ? ` · ${department.departmentCode}` : ""}
                          </p>
                        </div>
                      </div>

                      {canManageDepartmentLogs ? (
                        <Link href={`/directives/${directive.id}/logs/new?departmentId=${department.departmentId}`}>
                          <Button size="sm" variant="secondary">
                            로그 등록
                          </Button>
                        </Link>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["로그", `${department.logCount}건`],
                        ["증빙", `${department.attachmentCount}건`],
                        ["마감", formatDateLabel(department.dueDate)],
                        ["최근", formatRelativeUpdate(department.lastActivityAt)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-ink-100 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
                          <p className="mt-2 text-sm font-semibold text-ink-950">{value}</p>
                        </div>
                      ))}
                    </div>

                    {department.isRequestableByCurrentUser ? (
                      <WorkflowActionPanel
                        canRequestCompletion
                        departmentId={department.departmentId}
                        departmentLabel={department.departmentName ?? "현재 부서"}
                        directiveId={directive.id}
                      />
                    ) : null}

                    {canApproveDepartment ? (
                      <WorkflowActionPanel
                        canApprove
                        canReject
                        departmentId={department.departmentId}
                        departmentLabel={department.departmentName ?? "대상 부서"}
                        directiveId={directive.id}
                      />
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">행동 로그</h2>
                <p className="mt-1 text-sm text-ink-700">
                  부서별 실행 로그가 하나의 타임라인으로 모입니다. 상세에서는 전체를 보고, 로그 카드에서는 어느 부서 기록인지 바로 확인할 수 있습니다.
                </p>
              </div>
            </div>

            {directive.logs.length === 0 ? (
              <EmptyState
                title="등록된 행동 로그가 없습니다"
                description="현장 조치가 시작되면 첫 로그부터 남겨 주세요."
                action={
                  directive.workflow.canManageLogs ? (
                    <Link
                      href={`/directives/${directive.id}/logs/new${
                        directive.workflow.currentDepartmentId
                          ? `?departmentId=${directive.workflow.currentDepartmentId}`
                          : ""
                      }`}
                    >
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
                      directive.workflow.canManageLogs &&
                      (directive.workflow.canManageMultipleDepartments ||
                        log.departmentId === directive.workflow.currentDepartmentId) ? (
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
                사진과 문서를 한 곳에서 확인합니다. 파일은 private bucket에서 signed URL로 열립니다.
              </p>
            </div>
            <AttachmentList attachments={directive.attachments} />
          </section>
        </div>
      )}
    </AppFrame>
  );
}
