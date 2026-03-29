export type UserRole =
  | "CEO"
  | "SUPER_ADMIN"
  | "DEPARTMENT_HEAD"
  | "STAFF"
  | "VIEWER";

export interface AppSession {
  departmentCode: string | null;
  departmentId: string | null;
  departmentName: string | null;
  email: string;
  name: string;
  position: string | null;
  role: UserRole;
  userId: string;
}

export interface LoginDepartmentOption {
  code: string;
  id: string;
  name: string;
  users: LoginUserOption[];
}

export interface LoginUserOption {
  departmentId: string | null;
  id: string;
  name: string;
  position: string | null;
  role: UserRole;
}
