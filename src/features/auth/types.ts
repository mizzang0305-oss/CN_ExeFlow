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

export interface LoginDepartmentOption {
  code: string;
  headUserId: string | null;
  headUserName: string | null;
  id: string;
  name: string;
  userCount: number;
}

export interface LoginUserOption {
  departmentId: string | null;
  departmentName: string | null;
  displayName: string;
  id: string;
  name: string;
  profileName: string | null;
  role: UserRole;
  title: string | null;
}

export interface LoginBootstrapData {
  departments: LoginDepartmentOption[];
}

export interface LoginUsersData {
  department: LoginDepartmentOption | null;
  users: LoginUserOption[];
}

export interface ActivationLookupData {
  canActivate: boolean;
  profile: AuthenticatedUserProfile | null;
}

export interface LoginRequestInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface ActivateAccountInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface PasswordResetRequestInput {
  email: string;
  redirectTo: string;
}
