import { executiveRoles } from "./constants";
import type { UserRole } from "./types";

export const COMPANY_EMAIL_DOMAIN = "@seanfood.com";

export function normalizeEmailAddress(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function hasCompanyEmail(email: string | null | undefined) {
  const normalized = normalizeEmailAddress(email);
  return normalized?.endsWith(COMPANY_EMAIL_DOMAIN) === true;
}

export function getDefaultAppRoute(role: UserRole) {
  void role;
  return "/dashboard";
}

export function isExecutiveRole(role: UserRole) {
  return executiveRoles.includes(role as (typeof executiveRoles)[number]);
}

export function isAdminRole(role: UserRole) {
  return role === "CEO" || role === "SUPER_ADMIN";
}

export function canApproveDirective(role: UserRole) {
  return isAdminRole(role) || isExecutiveRole(role);
}

export function canAccessApprovalQueue(role: UserRole) {
  return canApproveDirective(role);
}

export function canViewDashboard(role: UserRole) {
  void role;
  return true;
}

export function isReadOnlyRole(role: UserRole) {
  return role === "VIEWER";
}

export const roleLabelMap: Record<UserRole, string> = {
  CEO: "대표",
  SUPER_ADMIN: "슈퍼관리자",
  DEPARTMENT_HEAD: "부서장",
  STAFF: "실무 담당",
  VIEWER: "조회 전용",
};
