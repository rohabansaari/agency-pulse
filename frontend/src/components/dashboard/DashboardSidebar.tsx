"use client";

import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { navItemsForRole } from "@/lib/navigation";
import type { NavItem } from "@/lib/navigation";
import type { User, UserRole } from "@/lib/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

interface DashboardSidebarProps {
  user: User;
  onLogout: () => void;
  loggingOut: boolean;
  onNavigate?: () => void;
}

const ICONS: Record<string, ReactNode> = {
  Dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  "Time Tracking": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  Projects: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M3 7h18M3 12h18M3 17h18" />
    </svg>
  ),
  "My Projects": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  ),
  Teams: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  "My Teams": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Employees: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Leave: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  "Leave Management": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  ),
  "Overtime Management": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  Payroll: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  Reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M4 19V5M10 19V9M16 19v-6M22 19V3" />
    </svg>
  ),
  Settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  Platform: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const GROUP_LABELS: Record<string, string[]> = {
  overview: ["Dashboard", "Platform"],
  workspace: ["Teams", "My Teams", "Projects", "My Projects", "Employees"],
  operations: ["Time Tracking", "Leave", "Leave Management", "Overtime Management", "Payroll"],
  insights: ["Reports", "Settings"],
};

function groupNavItems(items: NavItem[], role: UserRole): NavGroup[] {
  if (role === "employee" || role === "manager" || role === "super_admin") {
    return [{ id: "main", label: "Menu", items }];
  }

  const groups: NavGroup[] = [];
  for (const [id, labels] of Object.entries(GROUP_LABELS)) {
    const groupItems = items.filter((item) => labels.includes(item.label));
    if (groupItems.length > 0) {
      groups.push({
        id,
        label: id === "overview" ? "Overview" : id === "workspace" ? "Workspace" : id === "operations" ? "Operations" : "Admin",
        items: groupItems,
      });
    }
  }

  return groups.length > 0 ? groups : [{ id: "main", label: "Menu", items }];
}

export function DashboardSidebar({
  user,
  onLogout,
  loggingOut,
  onNavigate,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const items = navItemsForRole(user.role);
  const groups = useMemo(() => groupNavItems(items, user.role), [items, user.role]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function isActive(item: NavItem): boolean {
    return (
      pathname === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/leave" &&
        pathname.startsWith(item.href))
    );
  }

  function toggleGroup(id: string): void {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="flex w-full flex-col">
      <div className="border-b border-zinc-200/80 px-4 py-4 dark:border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            AP
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              AgencyPulse
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Workforce</p>
          </div>
        </Link>
      </div>

      <nav className="space-y-3 px-3 py-3">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.id] ?? false;
          const showToggle = groups.length > 1 && group.id !== "overview";

          return (
            <div key={group.id}>
              {showToggle ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
                >
                  {group.label}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              ) : null}

              {!isCollapsed ? (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/50"
                            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
                        }`}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-current">
                          {ICONS[item.label]}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-zinc-200/80 p-3 dark:border-zinc-800">
        <div className="mb-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {user.name}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
          <RoleBadge role={user.role} className="mt-1" />
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
        >
          {loggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
