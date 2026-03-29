"use client";

import { useMemo, useState } from "react";

import type { DepartmentUpsertInput, MasterDepartmentItem, MasterUserItem } from "@/features/master/types";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { FieldGroup, FieldLabel, Input, Select } from "../ui/field";

type DepartmentEditorMode =
  | {
      type: "create-child";
    }
  | {
      type: "create-root";
    }
  | {
      type: "edit";
    };

type DepartmentEditorProps = {
  allDepartments: MasterDepartmentItem[];
  mode: DepartmentEditorMode;
  onCancelCreate: () => void;
  onMove: (parentId: string | null) => Promise<void> | void;
  onSave: (input: DepartmentUpsertInput) => Promise<void> | void;
  onStartCreateChild: () => void;
  onStartCreateRoot: () => void;
  pending: boolean;
  selectedDepartment: MasterDepartmentItem | null;
  users: MasterUserItem[];
};

type DepartmentFormState = {
  code: string;
  headUserId: string;
  isActive: boolean;
  name: string;
  sortOrder: string;
};

function buildFormState(mode: DepartmentEditorMode, department: MasterDepartmentItem | null): DepartmentFormState {
  if (mode.type === "edit" && department) {
    return {
      code: department.code,
      headUserId: department.headUserId ?? "",
      isActive: department.isActive,
      name: department.name,
      sortOrder: String(department.sortOrder),
    };
  }

  return {
    code: "",
    headUserId: "",
    isActive: true,
    name: "",
    sortOrder: String(department?.sortOrder ?? 0),
  };
}

function isDescendantDepartment(
  departments: MasterDepartmentItem[],
  sourceDepartmentId: string,
  targetDepartmentId: string,
) {
  const departmentMap = new Map(departments.map((department) => [department.id, department]));
  let cursor = departmentMap.get(targetDepartmentId)?.parentId ?? null;

  while (cursor) {
    if (cursor === sourceDepartmentId) {
      return true;
    }

    cursor = departmentMap.get(cursor)?.parentId ?? null;
  }

  return false;
}

export function DepartmentEditor({
  allDepartments,
  mode,
  onCancelCreate,
  onMove,
  onSave,
  onStartCreateChild,
  onStartCreateRoot,
  pending,
  selectedDepartment,
  users,
}: DepartmentEditorProps) {
  const [form, setForm] = useState<DepartmentFormState>(() => buildFormState(mode, selectedDepartment));
  const [moveParentId, setMoveParentId] = useState(selectedDepartment?.parentId ?? "");

  const activeUsers = useMemo(
    () => users.filter((user) => user.isActive).sort((left, right) => left.displayName.localeCompare(right.displayName, "ko")),
    [users],
  );

  const parentOptions = useMemo(() => {
    if (!selectedDepartment || mode.type !== "edit") {
      return allDepartments;
    }

    return allDepartments.filter(
      (department) =>
        department.id !== selectedDepartment.id &&
        !isDescendantDepartment(allDepartments, selectedDepartment.id, department.id),
    );
  }, [allDepartments, mode.type, selectedDepartment]);

  const parentDepartment =
    mode.type === "create-child"
      ? selectedDepartment
      : selectedDepartment?.parentId
        ? allDepartments.find((department) => department.id === selectedDepartment.parentId) ?? null
        : null;

  const title =
    mode.type === "create-root"
      ? "최상위 부서 추가"
      : mode.type === "create-child"
        ? "하위 부서 추가"
        : "부서 상세";

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold tracking-tight text-ink-950">{title}</p>
            {selectedDepartment && mode.type === "edit" ? (
              <>
                <Badge tone={selectedDepartment.isActive ? "success" : "muted"}>
                  {selectedDepartment.isActive ? "활성" : "비활성"}
                </Badge>
                <Badge tone="default">{selectedDepartment.code}</Badge>
              </>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-ink-700">
            {mode.type === "edit"
              ? "부서 기본 정보와 부서장, 정렬, 활성 상태를 바로 수정할 수 있습니다."
              : "최소 입력만으로 조직 구조를 빠르게 추가합니다."}
          </p>
          {selectedDepartment ? (
            <p className="text-xs text-ink-500">{`경로: ${selectedDepartment.fullPath}`}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onStartCreateRoot} disabled={pending}>
            최상위 추가
          </Button>
          {selectedDepartment ? (
            <Button type="button" size="sm" variant="ghost" onClick={onStartCreateChild} disabled={pending}>
              하위 부서 추가
            </Button>
          ) : null}
        </div>
      </div>

      {(mode.type === "create-child" || mode.type === "create-root" || selectedDepartment) ? (
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave({
              code: form.code,
              headUserId: form.headUserId || null,
              isActive: form.isActive,
              name: form.name,
              parentId: mode.type === "create-root" ? null : mode.type === "create-child" ? selectedDepartment?.id ?? null : selectedDepartment?.parentId ?? null,
              sortOrder: Number.parseInt(form.sortOrder || "0", 10),
            });
          }}
        >
          <FieldGroup>
            <FieldLabel label="부서명" required />
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="영업본부"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="부서 코드" required />
            <Input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              placeholder="SALES_HQ"
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="정렬 순서" required />
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel label="부서장 지정" />
            <Select
              value={form.headUserId}
              onChange={(event) => setForm((current) => ({ ...current, headUserId: event.target.value }))}
            >
              <option value="">미지정</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {`${user.displayName} · ${user.departmentName ?? "미배정"}`}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <div className="md:col-span-2 flex flex-wrap items-center gap-4 rounded-[22px] bg-surface px-4 py-4">
            <label className="inline-flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-4 w-4 rounded border border-ink-300 text-brand-700"
              />
              활성 조직으로 유지
            </label>
            <span className="text-sm text-ink-500">
              {mode.type === "create-root"
                ? "최상위 조직으로 생성됩니다."
                : mode.type === "create-child"
                  ? `상위 조직: ${selectedDepartment?.name ?? "미선택"}`
                  : `상위 조직: ${parentDepartment?.name ?? "최상위"}`}
            </span>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button
              type="submit"
              size="md"
              isLoading={pending}
              loadingLabel={mode.type === "edit" ? "부서 저장 중" : "부서 생성 중"}
            >
              {mode.type === "edit" ? "부서 저장" : "부서 생성"}
            </Button>
            {mode.type !== "edit" ? (
              <Button type="button" size="md" variant="ghost" onClick={onCancelCreate} disabled={pending}>
                생성 취소
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="rounded-[22px] border border-dashed border-ink-200 bg-surface/70 px-5 py-6 text-sm text-ink-700">
          좌측 조직 트리에서 부서를 선택하면 상세 편집 패널이 열립니다.
        </div>
      )}

      {mode.type === "edit" && selectedDepartment ? (
        <div className="space-y-3 rounded-[24px] border border-ink-200 bg-white px-5 py-5">
          <div>
            <p className="text-sm font-semibold text-ink-950">상위 조직 변경</p>
            <p className="mt-1 text-sm text-ink-700">
              데스크톱에서는 드래그로, 모바일에서는 아래 선택으로 상위 조직을 변경할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Select value={moveParentId} onChange={(event) => setMoveParentId(event.target.value)}>
              <option value="">최상위 조직</option>
              {parentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.fullPath}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="md"
              variant="secondary"
              disabled={pending || (moveParentId || null) === (selectedDepartment.parentId ?? null)}
              onClick={() => void onMove(moveParentId || null)}
            >
              상위 변경
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
