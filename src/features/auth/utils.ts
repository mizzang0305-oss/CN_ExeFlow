import { executiveRoles } from "./constants";
import type { UserRole } from "./types";

export function getDefaultAppRoute(role: UserRole) {
  if (role === "DEPARTMENT_HEAD") {
    return "/board";
  }

  if (role === "STAFF") {
    return "/directives";
  }

  if (role === "VIEWER") {
    return "/dashboard";
  }

  return executiveRoles.includes(role as (typeof executiveRoles)[number]) ? "/dashboard" : "/directives";
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
  return isExecutiveRole(role) || role === "VIEWER";
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
