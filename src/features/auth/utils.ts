import { executiveRoles } from "./constants";
import type { UserRole } from "./types";

export function getDefaultAppRoute(role: UserRole) {
  return executiveRoles.includes(role as (typeof executiveRoles)[number])
    ? "/dashboard"
    : "/directives";
}

export function isExecutiveRole(role: UserRole) {
  return executiveRoles.includes(role as (typeof executiveRoles)[number]);
}
