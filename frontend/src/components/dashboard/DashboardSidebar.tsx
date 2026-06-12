"use client";

import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { navItemsForRole } from "@/lib/navigation";
import type { NavItem } from "@/lib/navigation";
import type { User, UserRole } from "@/lib/types";
import {
  BarChart3,
  Building2,
  Camera,
  Calendar,
  CalendarClock,
  ChevronDown,
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
import { useMemo, useState, type ComponentType } from "react";

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

  const homeHref = user.role === "super_admin" ? "/platform" : "/dashboard";
  const productLabel = user.role === "super_admin" ? "Platform" : "Workforce";

  return (
    <div className="flex h-full min-h-screen flex-col">
      <div className="shrink-0 border-b border-zinc-200/80 px-4 py-4 dark:border-zinc-800">
        <Link href={homeHref} className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            AP
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              AgencyPulse
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{productLabel}</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-3 px-3 py-3">
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
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>
              ) : null}

              {!isCollapsed ? (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item);
                    const Icon = ICONS[item.label];
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
                        {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} /> : null}
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

      <div className="shrink-0 border-t border-zinc-200/80 p-3 dark:border-zinc-800">
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
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
