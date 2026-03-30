"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { UserRole } from "@/features/auth/types";
import { getDefaultAppRoute } from "@/features/auth/utils";

type RoleRouteGuardProps = {
  currentPath: string;
  role: UserRole;
};

export function RoleRouteGuard({ currentPath, role }: RoleRouteGuardProps) {
  const router = useRouter();
  const expectedPath = getDefaultAppRoute(role);
  const isAllowed =
    currentPath === expectedPath ||
    currentPath.startsWith(`${expectedPath}/`);

  useEffect(() => {
    if (!isAllowed) {
      router.replace(expectedPath);
    }
  }, [expectedPath, isAllowed, router]);

  if (isAllowed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(243,247,252,0.92)] backdrop-blur-sm" aria-hidden="true" />
  );
}
