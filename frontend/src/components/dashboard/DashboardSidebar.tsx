"use client";

import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { navItemsForRole } from "@/lib/navigation";
import type { NavItem } from "@/lib/navigation";
import type { User, UserRole } from "@/lib/types";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarClock,
  Camera,
  Clock,
  DollarSign,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  UsersRound,
  Wallet,
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
  "Advance Salary": Wallet,
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
    { id: "ops", label: "Operations", labels: ["Leave Management", "Overtime Management", "Payroll", "Advance Salary"] },
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
    { id: "people", label: "People", labels: ["Leave", "Advance Salary"] },
    { id: "insights", label: "Insights", labels: ["Reports"] },
  ],
  employee: [
    { id: "overview", label: "Overview", labels: ["Dashboard"] },
    { id: "work", label: "Work", labels: ["Time Tracking", "My Projects", "Screenshots"] },
    { id: "people", label: "Time off", labels: ["Leave", "Advance Salary"] },
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
      <div className="shrink-0 px-4 py-5">
        <Link href={homeHref} className="flex items-center gap-3" onClick={onNavigate}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-xs font-bold text-[var(--primary-foreground)] shadow-sm">
            AP
          </span>
          <div className="min-w-0">
            <p className="text-heading truncate text-sm text-[var(--foreground)]">AgencyPulse</p>
            <p className="text-[11px] text-[var(--sidebar-muted)]">Workforce platform</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 px-3 py-2">
        {groups.map((group) => (
          <div key={group.id}>
            {groups.length > 1 ? (
              <p className="text-label mb-2 px-3">{group.label}</p>
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
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-150",
                      active
                        ? "bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-text)] shadow-sm"
                        : "font-medium text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="sidebar-active-indicator"
                        className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--sidebar-active-accent)]"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    ) : null}
                    {Icon ? (
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          active
                            ? "bg-[var(--primary-muted)] text-[var(--sidebar-active-accent)]"
                            : "bg-transparent text-[var(--sidebar-muted)] group-hover:bg-[var(--sidebar-hover)] group-hover:text-[var(--foreground)]",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                      </span>
                    ) : null}
                    <span className="flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-[var(--sidebar-border)] p-3">
        <div className="mb-2 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 py-3">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{user.name}</p>
          <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
          <RoleBadge role={user.role} className="mt-2" />
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--accent-coral-soft)] hover:text-[var(--danger)] disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
