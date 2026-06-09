import type { UserRole } from "./types";

export type NavItem = {
  label: string;
  href: string;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", roles: ["admin", "manager", "employee"] },
  { label: "Teams", href: "/teams", roles: ["admin"] },
  { label: "My Teams", href: "/my-teams", roles: ["manager"] },
  { label: "Projects", href: "/projects", roles: ["admin", "manager"] },
  { label: "My Projects", href: "/projects", roles: ["employee"] },
  { label: "Time Tracking", href: "/time", roles: ["admin", "manager", "employee"] },
  { label: "Leave", href: "/leave", roles: ["employee"] },
  { label: "Leave", href: "/leave/approvals", roles: ["manager"] },
  { label: "Leave Management", href: "/admin/leave", roles: ["admin"] },
  { label: "Payroll", href: "/admin/payroll", roles: ["admin"] },
  { label: "Reports", href: "/reports", roles: ["admin", "manager"] },
  { label: "Employees", href: "/employees", roles: ["admin"] },
  { label: "Settings", href: "/settings", roles: ["admin"] },
];

const ROLE_NAV: Record<UserRole, string[]> = {
  employee: ["Dashboard", "Time Tracking", "My Projects", "Leave"],
  manager: ["Dashboard", "Time Tracking", "My Teams", "Projects", "Leave", "Reports"],
  admin: [
    "Dashboard",
    "Time Tracking",
    "Teams",
    "Projects",
    "Leave Management",
    "Payroll",
    "Reports",
    "Employees",
    "Settings",
  ],
};

export function navItemsForRole(role: UserRole): NavItem[] {
  const allowed = ROLE_NAV[role];
  return NAV_ITEMS.filter(
    (item) => allowed.includes(item.label) && item.roles.includes(role),
  );
}

export function leaveHomeForRole(role: UserRole): string {
  if (role === "admin") {
    return "/admin/leave";
  }

  if (role === "manager") {
    return "/leave/approvals";
  }

  return "/leave";
}

export function canManageProjects(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canSetProjectHourlyRate(role: UserRole): boolean {
  return role === "admin";
}

export function canArchiveProjects(role: UserRole): boolean {
  return role === "admin";
}

export function canViewOrgTimeEntries(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canViewReports(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canManageWorkTeams(role: UserRole): boolean {
  return role === "admin";
}

export function canViewWorkTeams(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canManageOrgEmployees(role: UserRole): boolean {
  return role === "admin";
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isEmployee(role: UserRole): boolean {
  return role === "employee";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  admin: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  employee: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};
