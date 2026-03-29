"use client";

import { useState } from "react";

import type { OrgDepartmentNode } from "@/features/master/types";
import { cn } from "@/lib/utils";

import { Badge } from "../ui/badge";

type DragItem = {
  id: string;
  type: "department" | "user";
} | null;

type OrgNodeProps = {
  dragItem: DragItem;
  expandedIds: Set<string>;
  isPending: boolean;
  level: number;
  node: OrgDepartmentNode;
  onDepartmentDrop: (targetDepartmentId: string) => void;
  onDragEnd: () => void;
  onDragStartDepartment: (departmentId: string) => void;
  onSelect: (departmentId: string) => void;
  onToggle: (departmentId: string) => void;
  selectedDepartmentId: string | null;
  canDropOnDepartment: (targetDepartmentId: string) => boolean;
};

export function OrgNode({
  canDropOnDepartment,
  dragItem,
  expandedIds,
  isPending,
  level,
  node,
  onDepartmentDrop,
  onDragEnd,
  onDragStartDepartment,
  onSelect,
  onToggle,
  selectedDepartmentId,
}: OrgNodeProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedDepartmentId === node.id;
  const canDrop = dragItem ? canDropOnDepartment(node.id) : false;

  return (
    <div className="space-y-2">
      <div
        onDragLeave={() => setIsDragOver(false)}
        onDragOver={(event) => {
          if (!canDrop) {
            return;
          }

          event.preventDefault();
          setIsDragOver(true);
        }}
        onDrop={(event) => {
          if (!canDrop) {
            return;
          }

          event.preventDefault();
          setIsDragOver(false);
          onDepartmentDrop(node.id);
        }}
        className={cn(
          "rounded-[24px] border border-transparent transition",
          isDragOver && canDrop && "border-brand-500 bg-brand-50/70 shadow-[0_12px_24px_rgba(23,92,211,0.12)]",
        )}
      >
        <div
          draggable={!isPending}
          onDragEnd={() => {
            setIsDragOver(false);
            onDragEnd();
          }}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            onDragStartDepartment(node.id);
          }}
          className="flex items-start gap-2"
          style={{ paddingLeft: `${Math.min(level * 14, 56)}px` }}
        >
          <button
            type="button"
            onClick={() => (hasChildren ? onToggle(node.id) : onSelect(node.id))}
            className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-ink-600 ring-1 ring-ink-200 transition hover:bg-brand-50 hover:text-brand-700"
            aria-label={hasChildren ? (isExpanded ? "하위 조직 접기" : "하위 조직 펼치기") : "부서 선택"}
          >
            {hasChildren ? (isExpanded ? "−" : "+") : "•"}
          </button>

          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className={cn(
              "flex min-w-0 flex-1 items-start justify-between gap-3 rounded-[22px] border px-4 py-3 text-left transition",
              isSelected
                ? "border-brand-200 bg-brand-50 shadow-[0_12px_28px_rgba(23,92,211,0.08)]"
                : "border-ink-200 bg-white hover:border-brand-100 hover:bg-brand-50/40",
              !node.isActive && "opacity-70",
            )}
          >
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-ink-950">{node.name}</p>
                {!node.isActive ? <Badge tone="muted">비활성</Badge> : null}
                {node.depth === 0 ? <Badge tone="default">루트</Badge> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <span>{node.code}</span>
                <span>{node.headUserName ? `부서장 ${node.headUserName}` : "부서장 미지정"}</span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <Badge tone="default">{`사용자 ${node.activeUserCount}`}</Badge>
              {node.childCount > 0 ? <span className="text-xs text-ink-500">{`하위 ${node.childCount}`}</span> : null}
            </div>
          </button>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div className="ml-3 border-l border-ink-200/80 pl-2">
          {node.children.map((child) => (
            <OrgNode
              key={child.id}
              canDropOnDepartment={canDropOnDepartment}
              dragItem={dragItem}
              expandedIds={expandedIds}
              isPending={isPending}
              level={level + 1}
              node={child}
              onDepartmentDrop={onDepartmentDrop}
              onDragEnd={onDragEnd}
              onDragStartDepartment={onDragStartDepartment}
              onSelect={onSelect}
              onToggle={onToggle}
              selectedDepartmentId={selectedDepartmentId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
