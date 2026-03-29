import type { UserRole } from "@/features/auth/types";

export interface MasterDepartmentItem {
  activeUserCount: number;
  childCount: number;
  code: string;
  depth: number;
  fullPath: string;
  headUserId: string | null;
  headUserName: string | null;
  id: string;
  isActive: boolean;
  name: string;
  parentId: string | null;
  sortOrder: number;
  updatedAt: string | null;
}

export interface MasterUserItem {
  departmentCode: string | null;
  departmentId: string | null;
  departmentName: string | null;
  displayName: string;
  email: string | null;
  id: string;
  isActive: boolean;
  name: string;
  profileName: string | null;
  role: UserRole;
  title: string | null;
  updatedAt: string | null;
}

export interface OrgDepartmentNode extends MasterDepartmentItem {
  children: OrgDepartmentNode[];
}

export interface OrgTreeData {
  departments: MasterDepartmentItem[];
  tree: OrgDepartmentNode[];
  users: MasterUserItem[];
}

export interface DepartmentUpsertInput {
  code: string;
  headUserId: string | null;
  isActive: boolean;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export interface DepartmentReorderInput {
  departmentId: string;
  parentId: string | null;
}

export interface UserUpsertInput {
  departmentId: string | null;
  email: string;
  isActive: boolean;
  name: string;
  profileName: string | null;
  role: UserRole;
  title: string | null;
}

export interface UserMoveInput {
  departmentId: string | null;
  userId: string;
}

export interface MasterLookupData {
  departments: MasterDepartmentItem[];
  users: MasterUserItem[];
}
