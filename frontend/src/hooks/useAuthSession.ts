"use client";

import { ApiError, fetchMe, logout } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import type { MeResponse, User } from "@/lib/types";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function useAuthSession() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Omit<MeResponse, "user"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    fetchMe()
      .then((response) => {
        if (response.user.role === "super_admin" && pathname !== "/platform") {
          router.replace("/platform");
          return;
        }

        setUser(response.user);
        setSession({
          memberships: response.memberships,
          current_organization_id: response.current_organization_id,
        });
      })
      .catch((err) => {
        clearToken();
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError("Unable to load your profile.");
      })
      .finally(() => setLoading(false));
  }, [router, pathname]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  }, [router]);

  const organizationName =
    user?.role === "super_admin"
      ? "AgencyPulse Platform"
      : session?.memberships.find(
          (m) => m.organization_id === session.current_organization_id,
        )?.organization_name ?? session?.memberships[0]?.organization_name ?? null;

  return {
    user,
    session,
    organizationName,
    loading,
    error,
    loggingOut,
    handleLogout,
  };
}
