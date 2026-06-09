"use client";

import type { UserRole } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRoleRedirect(
  role: UserRole,
  allowedRoles: UserRole[],
  redirectTo: string,
) {
  const router = useRouter();

  useEffect(() => {
    if (!allowedRoles.includes(role)) {
      router.replace(redirectTo);
    }
  }, [allowedRoles, redirectTo, role, router]);

  return allowedRoles.includes(role);
}
