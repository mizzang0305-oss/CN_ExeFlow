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
  displayName: string;
  email: string | null;
  name: string;
  profileName: string | null;
  role: UserRole;
  title: string | null;
  userId: string;
}

export interface AuthenticatedUserProfile {
  authUserId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  displayName: string;
  email: string | null;
  isActivated: boolean;
  name: string;
  profileName: string | null;
  role: UserRole;
  title: string | null;
  userId: string;
}

export interface AuthLookupResult {
  found: boolean;
  user: AuthenticatedUserProfile | null;
}

export interface SessionCreateResult {
  redirectTo: string;
  session: AppSession;
}

export interface AuthLoginResult extends SessionCreateResult {
  rememberMe: boolean;
}
