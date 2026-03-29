"use client";

import type { OrgTreeData } from "@/features/master/types";
import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { OrgNode } from "./org-node";

type DragItem = {
  id: string;
  type: "department" | "user";
} | null;

type OrgTreeProps = {
  canDropOnDepartment: (targetDepartmentId: string | null) => boolean;
  dragItem: DragItem;
  expandedIds: Set<string>;
  isPending: boolean;
  onDepartmentDrop: (targetDepartmentId: string | null) => void;
  onDragEnd: () => void;
  onDragStartDepartment: (departmentId: string) => void;
  onSelect: (departmentId: string) => void;
  onStartCreateRoot: () => void;
  onToggle: (departmentId: string) => void;
  selectedDepartmentId: string | null;
  snapshot: OrgTreeData;
};

export function OrgTree({
  canDropOnDepartment,
  dragItem,
  expandedIds,
  isPending,
  onDepartmentDrop,
  onDragEnd,
  onDragStartDepartment,
  onSelect,
  onStartCreateRoot,
  onToggle,
  selectedDepartmentId,
  snapshot,
}: OrgTreeProps) {
  const canDropOnRoot = dragItem?.type === "department" && canDropOnDepartment(null);

  return (
    <Card className="h-full space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Organization Tree</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink-950">조직 구조</h2>
          <p className="mt-1 text-sm leading-6 text-ink-700">
            회사 → 본부 → 부서 → 팀 계층을 펼치고 접으면서 구조와 사용자 현황을 함께 관리합니다.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onStartCreateRoot} disabled={isPending}>
          최상위 부서 추가
        </Button>
      </div>

      <div
        onDragOver={(event) => {
          if (!canDropOnRoot) {
            return;
          }

          event.preventDefault();
        }}
        onDrop={(event) => {
          if (!canDropOnRoot) {
            return;
          }

          event.preventDefault();
          onDepartmentDrop(null);
        }}
        className={cn(
          "rounded-[22px] border border-dashed px-4 py-3 text-sm transition",
          canDropOnRoot
            ? "border-brand-300 bg-brand-50/70 text-brand-800"
            : "border-ink-200 bg-surface/70 text-ink-600",
        )}
      >
        최상위 조직으로 이동하려면 부서를 여기로 드롭하세요.
      </div>

      <div className="space-y-3">
        {snapshot.tree.length === 0 ? (
          <EmptyState
            title="등록된 조직이 없습니다"
            description="최상위 부서를 추가하면 조직도 기반 관리가 바로 시작됩니다."
          />
        ) : (
          snapshot.tree.map((node) => (
            <OrgNode
              key={node.id}
              canDropOnDepartment={(targetDepartmentId) => canDropOnDepartment(targetDepartmentId)}
              dragItem={dragItem}
              expandedIds={expandedIds}
              isPending={isPending}
              level={0}
              node={node}
              onDepartmentDrop={(targetDepartmentId) => onDepartmentDrop(targetDepartmentId)}
              onDragEnd={onDragEnd}
              onDragStartDepartment={onDragStartDepartment}
              onSelect={onSelect}
              onToggle={onToggle}
              selectedDepartmentId={selectedDepartmentId}
            />
          ))
        )}
      </div>
    </Card>
  );
}
