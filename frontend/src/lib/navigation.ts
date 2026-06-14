import type { UserRole } from "./types";

export type NavItem = {
  label: string;
  href: string;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Platform", href: "/platform", roles: ["super_admin"] },
  { label: "Dashboard", href: "/dashboard", roles: ["admin", "sub_admin", "manager", "employee"] },
  { label: "Teams", href: "/teams", roles: ["admin", "sub_admin"] },
  { label: "My Teams", href: "/my-teams", roles: ["manager"] },
  { label: "Projects", href: "/projects", roles: ["admin", "sub_admin", "manager"] },
  { label: "My Projects", href: "/projects", roles: ["employee"] },
  { label: "Time Tracking", href: "/time", roles: ["manager", "employee"] },
  { label: "Screenshots", href: "/screenshots", roles: ["admin", "sub_admin", "manager", "employee"] },
  { label: "Leave", href: "/leave", roles: ["employee"] },
  { label: "Leave", href: "/leave/approvals", roles: ["manager"] },
  { label: "Advance Salary", href: "/advances", roles: ["employee", "manager"] },
  { label: "Advance Salary", href: "/admin/advances", roles: ["admin"] },
  { label: "Leave Management", href: "/admin/leave", roles: ["admin", "sub_admin"] },
  { label: "Overtime Management", href: "/admin/overtime", roles: ["admin", "sub_admin"] },
  { label: "Payroll", href: "/admin/payroll", roles: ["admin"] },
  { label: "Reports", href: "/reports", roles: ["admin", "sub_admin", "manager"] },
  { label: "Employees", href: "/employees", roles: ["admin", "sub_admin"] },
  { label: "Settings", href: "/settings", roles: ["admin"] },
];

const ROLE_NAV: Record<UserRole, string[]> = {
  super_admin: ["Platform"],
  employee: ["Dashboard", "Time Tracking", "My Projects", "Screenshots", "Leave", "Advance Salary"],
  manager: ["Dashboard", "Time Tracking", "My Teams", "Projects", "Leave", "Advance Salary", "Reports", "Screenshots"],
  sub_admin: [
    "Dashboard",
    "Teams",
    "Projects",
    "Employees",
    "Reports",
    "Screenshots",
    "Leave Management",
    "Overtime Management",
  ],
  admin: [
    "Dashboard",
    "Teams",
    "Projects",
    "Leave Management",
    "Overtime Management",
    "Payroll",
    "Advance Salary",
    "Reports",
    "Screenshots",
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
  if (role === "admin" || role === "sub_admin") {
    return "/admin/leave";
  }

  if (role === "manager") {
    return "/leave/approvals";
  }

  return "/leave";
}

export function canManageProjects(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin" || role === "manager";
}

export function canSetProjectHourlyRate(role: UserRole): boolean {
  return role === "admin";
}

export function canArchiveProjects(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin";
}

export function canViewOrgTimeEntries(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin" || role === "manager";
}

export function canViewReports(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin" || role === "manager";
}

export function canManageWorkTeams(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin";
}

export function canViewWorkTeams(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin" || role === "manager";
}

export function canManageOrgEmployees(role: UserRole): boolean {
  return role === "admin";
}

export function canViewOrgEmployees(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin";
}

export function canEditEmployeeStatus(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin";
}

export function canChangeEmployeeRoles(role: UserRole): boolean {
  return role === "admin";
}

export const CREATION_ROLES: UserRole[] = ["employee", "manager", "sub_admin"];
export const MUTABLE_ROLES: UserRole[] = ["employee", "manager"];
export const IMMUTABLE_ROLES: UserRole[] = ["admin", "sub_admin"];

export function isMutableMemberRole(role: UserRole): boolean {
  return MUTABLE_ROLES.includes(role);
}

export function canEditMemberStatus(memberRole: UserRole): boolean {
  return !IMMUTABLE_ROLES.includes(memberRole);
}

export function canChangeMemberRole(viewerRole: UserRole, memberRole: UserRole, isSelf: boolean): boolean {
  return canChangeEmployeeRoles(viewerRole) && !isSelf && isMutableMemberRole(memberRole);
}

export function isPrivilegedMember(role: UserRole): boolean {
  return IMMUTABLE_ROLES.includes(role);
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "super_admin";
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isSubAdmin(role: UserRole): boolean {
  return role === "sub_admin";
}

export function isOperationalAdmin(role: UserRole): boolean {
  return role === "admin" || role === "sub_admin";
}

export function canAccessPayroll(role: UserRole): boolean {
  return role === "admin";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sub_admin: "Sub Admin",
  manager: "Manager",
  employee: "Employee",
};

export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  super_admin: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  admin: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  sub_admin: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  employee: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};
