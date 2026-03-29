"use client";

import type { DepartmentUpsertInput, MasterDepartmentItem, MasterUserItem, UserUpsertInput } from "@/features/master/types";

import { EmptyState } from "../ui/empty-state";
import { DepartmentEditor } from "./department-editor";
import { UserEditor } from "./user-editor";
import { UserList } from "./user-list";

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

type UserEditorMode =
  | {
      type: "create";
    }
  | {
      type: "edit";
      userId: string;
    }
  | null;

type OrgPanelProps = {
  departmentMode: DepartmentEditorMode;
  departments: MasterDepartmentItem[];
  isPending: boolean;
  onCancelDepartmentCreate: () => void;
  onCancelUserEditor: () => void;
  onDepartmentMove: (parentId: string | null) => Promise<void> | void;
  onDepartmentSave: (input: DepartmentUpsertInput) => Promise<void> | void;
  onDragEnd: () => void;
  onDragStartUser: (userId: string) => void;
  onSaveUser: (input: UserUpsertInput) => Promise<void> | void;
  onStartCreateChild: () => void;
  onStartCreateRoot: () => void;
  onStartCreateUser: () => void;
  onToggleUserActive: (userId: string) => void;
  onUserEdit: (userId: string) => void;
  selectedDepartment: MasterDepartmentItem | null;
  userMode: UserEditorMode;
  users: MasterUserItem[];
};

export function OrgPanel({
  departmentMode,
  departments,
  isPending,
  onCancelDepartmentCreate,
  onCancelUserEditor,
  onDepartmentMove,
  onDepartmentSave,
  onDragEnd,
  onDragStartUser,
  onSaveUser,
  onStartCreateChild,
  onStartCreateRoot,
  onStartCreateUser,
  onToggleUserActive,
  onUserEdit,
  selectedDepartment,
  userMode,
  users,
}: OrgPanelProps) {
  const selectedUsers = selectedDepartment
    ? users
        .filter((user) => user.departmentId === selectedDepartment.id)
        .sort((left, right) => {
          if (left.isActive !== right.isActive) {
            return left.isActive ? -1 : 1;
          }

          return left.displayName.localeCompare(right.displayName, "ko");
        })
    : [];
  const editingUser = userMode?.type === "edit" ? users.find((user) => user.id === userMode.userId) ?? null : null;

  if (!selectedDepartment && departmentMode.type === "edit") {
    return (
      <EmptyState
        title="편집할 조직을 선택해 주세요"
        description="좌측 트리에서 부서를 선택하면 상세 편집, 사용자 관리, 드래그 이동을 바로 진행할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-4">
      <DepartmentEditor
        key={`${departmentMode.type}-${selectedDepartment?.id ?? "none"}`}
        allDepartments={departments}
        mode={departmentMode}
        onCancelCreate={onCancelDepartmentCreate}
        onMove={onDepartmentMove}
        onSave={onDepartmentSave}
        onStartCreateChild={onStartCreateChild}
        onStartCreateRoot={onStartCreateRoot}
        pending={isPending}
        selectedDepartment={selectedDepartment}
        users={users}
      />

      {selectedDepartment ? (
        <UserList
          isPending={isPending}
          onDragEnd={onDragEnd}
          onDragStartUser={onDragStartUser}
          onEditUser={onUserEdit}
          onStartCreateUser={onStartCreateUser}
          onToggleUserActive={onToggleUserActive}
          users={selectedUsers}
        />
      ) : null}

      {userMode ? (
        <UserEditor
          key={`${userMode.type}-${userMode.type === "edit" ? userMode.userId : selectedDepartment?.id ?? "none"}`}
          defaultDepartmentId={selectedDepartment?.id ?? null}
          departments={departments}
          initialUser={editingUser}
          onCancel={onCancelUserEditor}
          onSave={onSaveUser}
          pending={isPending}
        />
      ) : null}
    </div>
  );
}
