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
  hasCompanyEmail: boolean;
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
  message: string;
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
  users: LoginUserOption[];
}

export interface LoginUsersData {
  department: LoginDepartmentOption | null;
  users: LoginUserOption[];
}

export interface InitialSetupLookupData {
  canRegisterCompanyEmail: boolean;
  existingEmail: string | null;
  profile: AuthenticatedUserProfile | null;
}

export interface LoginRequestInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface InitialSetupLookupInput {
  departmentId: string;
  name: string;
  userId?: string | null;
}

export interface RegisterCompanyEmailInput {
  email: string;
  userId: string;
}

export interface RegisterCompanyEmailResult {
  email: string;
  message: string;
}

export interface ActivateAccountInput {
  password: string;
  passwordConfirm: string;
  userId: string;
}

export interface ActivateAccountResult {
  completed: true;
  email: string;
  message: string;
  redirectTo: string;
}

export interface PasswordResetRequestInput {
  email: string;
  redirectTo: string;
}
