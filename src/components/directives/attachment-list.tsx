import type { DirectiveAttachmentItem } from "@/features/directives/types";
import { formatDateTimeLabel } from "@/lib/format";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function AttachmentList({ attachments }: { attachments: DirectiveAttachmentItem[] }) {
  if (attachments.length === 0) {
    return (
      <EmptyState
        title="등록된 증빙이 없습니다"
        description="사진이나 문서를 올리면 여기에서 바로 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <Card key={attachment.id} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Badge tone={attachment.fileType === "IMAGE" ? "default" : "muted"}>
              {attachment.fileType === "IMAGE" ? "사진" : "문서"}
            </Badge>
            <span className="text-xs text-ink-500">{formatDateTimeLabel(attachment.uploadedAt)}</span>
          </div>

          {attachment.isImage && attachment.downloadUrl ? (
            <>
              {/* Signed Supabase URLs are dynamic and are served outside a fixed image config. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.downloadUrl}
                alt={attachment.fileName}
                className="h-40 w-full rounded-2xl object-cover"
                loading="lazy"
              />
            </>
          ) : null}

          <div className="space-y-1">
            <p className="line-clamp-1 text-sm font-semibold text-ink-950">{attachment.fileName}</p>
            <p className="text-xs text-ink-500">
              업로드: {attachment.uploadedByName ?? "사용자 미확인"}
            </p>
          </div>

          {attachment.downloadUrl ? (
            <a
              href={attachment.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-semibold text-brand-600"
            >
              파일 열기
            </a>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
