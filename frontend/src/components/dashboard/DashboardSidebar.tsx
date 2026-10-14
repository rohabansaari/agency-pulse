"use client";

import { PulseLogo } from "@/components/brand/PulseLogo";
import { ROLE_LABELS } from "@/lib/navigation";
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

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="app-sidebar-inner bg-[var(--night)] text-[var(--night-text)]">
      <div className="shrink-0 px-5 pb-4 pt-6">
        <Link href={homeHref} onClick={onNavigate} aria-label="AgencyPulse home">
          <PulseLogo tone="dark" className="text-[0.9375rem]" markClassName="h-8 w-8" />
        </Link>
      </div>

      <nav aria-label="Main" className="app-sidebar-nav space-y-5 px-3 pb-4">
        {groups.map((group) => (
          <div key={group.id}>
            {groups.length > 1 ? (
              <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--night-muted)]">
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
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex min-h-11 items-center gap-3 rounded-[0.625rem] px-3 text-sm transition-colors duration-150",
                      active
                        ? "bg-[var(--night-raised)] font-medium text-white"
                        : "text-[var(--night-text)] hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="sidebar-active-indicator"
                        className="absolute left-0 top-1/2 h-5 w-[0.1875rem] -translate-y-1/2 rounded-r-full bg-[var(--pulse-on-dark)]"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    ) : null}
                    {Icon ? (
                      <Icon
                        className={cn(
                          "h-[1.125rem] w-[1.125rem] shrink-0",
                          active ? "text-[var(--pulse-on-dark)]" : "text-[var(--night-muted)] group-hover:text-white",
                        )}
                        strokeWidth={active ? 2.1 : 1.8}
                      />
                    ) : null}
                    <span className="flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-[var(--night-border)] p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--night-raised)] text-xs font-semibold text-white">
            {initials || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-[var(--night-muted)]">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-[0.625rem] px-3 text-sm text-[var(--night-text)] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
