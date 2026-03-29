import type { UserRole } from "@/features/auth/types";

export interface MasterDepartmentItem {
  activeUserCount: number;
  code: string;
  headUserId: string | null;
  headUserName: string | null;
  id: string;
  isActive: boolean;
  name: string;
  sortOrder: number;
  updatedAt: string | null;
}

export interface MasterUserItem {
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

export interface DepartmentUpsertInput {
  code: string;
  headUserId: string | null;
  isActive: boolean;
  name: string;
  sortOrder: number;
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

export interface MasterLookupData {
  departments: MasterDepartmentItem[];
  users: MasterUserItem[];
}
