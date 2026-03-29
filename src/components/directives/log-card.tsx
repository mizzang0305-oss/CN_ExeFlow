import { directiveLogTypeLabels } from "@/features/directives/constants";
import type { DirectiveLogItem } from "@/features/directives/types";
import { formatDateTimeLabel } from "@/lib/format";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function LogCard({
  actions,
  log,
}: {
  actions?: React.ReactNode;
  log: DirectiveLogItem;
}) {
  return (
    <Card id={`log-${log.id}`} className="log-anchor-target scroll-mt-32 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="muted">
              {directiveLogTypeLabels[log.logType as keyof typeof directiveLogTypeLabels] ?? log.logType}
            </Badge>
            <span className="text-xs font-semibold text-ink-500">{formatDateTimeLabel(log.happenedAt)}</span>
          </div>
          <h3 className="text-base font-semibold text-ink-950">{log.actionSummary}</h3>
        </div>
        {actions}
      </div>

      <div className="space-y-3 text-sm leading-6 text-ink-700">
        {log.detail ? <p>{log.detail}</p> : null}
        {log.nextAction ? (
          <p>
            <strong className="text-ink-950">다음 조치:</strong> {log.nextAction}
          </p>
        ) : null}
        {log.riskNote ? (
          <p>
            <strong className="text-ink-950">리스크:</strong> {log.riskNote}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
        <span>{log.departmentName ?? "부서 미지정"}</span>
        <span>{log.userName ?? "작성자 미확인"}</span>
        <span>{`증빙 ${log.attachmentCount}건`}</span>
      </div>
    </Card>
  );
}
