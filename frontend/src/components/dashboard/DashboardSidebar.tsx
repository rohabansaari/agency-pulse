"use client";

import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { navItemsForRole } from "@/lib/navigation";
import type { NavItem } from "@/lib/navigation";
import type { User, UserRole } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarClock,
  Camera,
  ChevronRight,
  Clock,
  DollarSign,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ComponentType } from "react";

interface DashboardSidebarProps {
  user: User;
  onLogout: () => void;
  loggingOut: boolean;
  onNavigate?: () => void;
}

const ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Dashboard: LayoutDashboard,
  "Time Tracking": Clock,
  Projects: FolderKanban,
  "My Projects": FolderKanban,
  Teams: UsersRound,
  "My Teams": UsersRound,
  Employees: Users,
  Leave: Calendar,
  "Leave Management": CalendarClock,
  "Overtime Management": Clock,
  Payroll: DollarSign,
  Reports: BarChart3,
  Settings: Settings,
  Platform: Building2,
  Screenshots: Camera,
};

type NavGroup = { id: string; label: string; items: NavItem[] };

const GROUPS: Record<UserRole, { id: string; label: string; labels: string[] }[]> = {
  super_admin: [{ id: "main", label: "Platform", labels: ["Platform"] }],
  admin: [
    { id: "overview", label: "Overview", labels: ["Dashboard"] },
    { id: "people", label: "People", labels: ["Employees", "Teams"] },
    { id: "work", label: "Work", labels: ["Projects", "Time Tracking", "Screenshots"] },
    { id: "ops", label: "Operations", labels: ["Leave Management", "Overtime Management", "Payroll"] },
    { id: "insights", label: "Insights", labels: ["Reports", "Settings"] },
  ],
  sub_admin: [
    { id: "overview", label: "Overview", labels: ["Dashboard"] },
    { id: "people", label: "People", labels: ["Employees", "Teams"] },
    { id: "work", label: "Work", labels: ["Projects", "Screenshots"] },
    { id: "ops", label: "Operations", labels: ["Leave Management", "Overtime Management"] },
    { id: "insights", label: "Insights", labels: ["Reports"] },
  ],
  manager: [
    { id: "overview", label: "Overview", labels: ["Dashboard"] },
    { id: "work", label: "Work", labels: ["Time Tracking", "My Teams", "Projects", "Screenshots"] },
    { id: "people", label: "People", labels: ["Leave"] },
    { id: "insights", label: "Insights", labels: ["Reports"] },
  ],
  employee: [
    { id: "overview", label: "Overview", labels: ["Dashboard"] },
    { id: "work", label: "Work", labels: ["Time Tracking", "My Projects", "Screenshots"] },
    { id: "people", label: "Time off", labels: ["Leave"] },
  ],
};

function groupNavItems(items: NavItem[], role: UserRole): NavGroup[] {
  const config = GROUPS[role];
  return config
    .map(({ id, label, labels }) => ({
      id,
      label,
      items: items.filter((item) => labels.includes(item.label)),
    }))
    .filter((g) => g.items.length > 0);
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

  function isActive(item: NavItem): boolean {
    return (
      pathname === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/leave" &&
        pathname.startsWith(item.href))
    );
  }

  const homeHref = user.role === "super_admin" ? "/platform" : "/dashboard";

  return (
    <div className="flex h-full min-h-screen flex-col">
      <div className="shrink-0 border-b border-[var(--sidebar-border)] px-4 py-4">
        <Link href={homeHref} className="flex items-center gap-3" onClick={onNavigate}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-xs font-bold text-white shadow-sm">
            AP
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              AgencyPulse
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Workforce platform</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.id}>
            {groups.length > 1 ? (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = ICONS[item.label];
                return (
                  <Link
                    key={`${group.id}-${item.label}-${item.href}`}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all",
                      active
                        ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)] shadow-sm"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
                    )}
                  >
                    {Icon ? (
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-[var(--sidebar-active-text)]" : "text-zinc-400 group-hover:text-zinc-600",
                        )}
                        strokeWidth={active ? 2 : 1.75}
                      />
                    ) : null}
                    <span className="flex-1 truncate">{item.label}</span>
                    {active ? <ChevronRight className="h-3 w-3 shrink-0 opacity-60" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-[var(--sidebar-border)] p-3">
        <div className="mb-2 rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/40">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.name}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
          <RoleBadge role={user.role} className="mt-1.5" />
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
