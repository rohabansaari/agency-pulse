export type UserRole = "super_admin" | "admin" | "sub_admin" | "manager" | "employee";

export interface OrganizationMembership {
  id: number;
  organization_id: number;
  organization_name?: string;
  role: UserRole;
  status: string;
  joined_at: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  organization_id?: number;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  memberships: OrganizationMembership[];
  current_organization_id: number;
  token: string;
}

export interface MeResponse {
  user: User;
  memberships: OrganizationMembership[];
  current_organization_id: number | null;
}

export interface OnboardingStatus {
  requires_onboarding: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  completion_percent: number;
  organization: {
    name: string;
    timezone: string | null;
    logo_url: string | null;
    website: string | null;
  };
  pin_configured: boolean;
  requirements_met: boolean;
}

export interface ApiValidationError {
  message?: string;
  errors?: Record<string, string[]>;
}

export type TimeEntryType = "tracked" | "manual" | "leave";
export type TimeEntrySource = "employee" | "manager" | "admin";
export type TimeEntryStatus =
  | "running"
  | "stopped"
  | "pending"
  | "approved"
  | "rejected";
export type ProjectStatus = "active" | "inactive" | "archived";
export type MemberStatus = "active" | "invited" | "suspended";

export interface Project {
  id: number;
  organization_id: number;
  name: string;
  client_name: string;
  description?: string | null;
  hourly_rate?: string | null;
  status: ProjectStatus;
  members_count?: number;
  total_tracked_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: number;
  name: string;
  email: string;
  role?: string;
  role_in_project?: string;
  assigned_at?: string;
}

export interface ProjectAssignee {
  id: number;
  name: string;
  email: string;
  role_in_project?: string;
  assigned_at?: string;
}

export interface TeamMember {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
  status: MemberStatus;
  joined_at: string | null;
  created_at: string;
  team_id?: number | null;
  team_name?: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
  last_activity_at?: string | null;
  has_active_timer?: boolean;
  assigned_projects_count?: number;
  time_tracked_month_seconds?: number;
  approved_leave_seconds?: number;
  overtime_requests_count?: number;
}

export interface EmployeeProfile {
  membership_id: number;
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
  status: MemberStatus;
  joined_at: string | null;
  team: {
    id: number;
    name: string;
    manager: { id: number; name: string } | null;
  } | null;
  assigned_projects: { id: number; name: string; status: string }[];
  leave_history: {
    id: number;
    start_date: string;
    end_date: string;
    duration_seconds: number;
    status: string;
    is_paid: boolean;
    description: string | null;
  }[];
  overtime_history: {
    id: number;
    work_date: string;
    duration_seconds: number;
    status: string;
    reason: string | null;
  }[];
  time_summary: {
    month_seconds: number;
    approved_leave_seconds: number;
  };
  has_active_timer: boolean;
  last_activity_at: string | null;
  manager_metrics?: ManagerProfileMetrics | null;
}

export interface ManagerProfileMetrics {
  teams_managed: number;
  projects_managed: number;
  active_employees: number;
  total_team_hours_month_seconds: number;
  managed_teams: {
    id: number;
    name: string;
    members_count: number;
    active_projects: number;
  }[];
  managed_projects: {
    id: number;
    name: string;
    status: string;
  }[];
}

export interface TimeEntry {
  id: number;
  user_id: number;
  user_name?: string | null;
  organization_id?: number;
  type: TimeEntryType;
  project_id: number | null;
  project_name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  description?: string | null;
  is_paid?: boolean;
  source?: TimeEntrySource | null;
  status: TimeEntryStatus;
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveBreakdownPeriod {
  paid_seconds: number;
  pending_seconds: number;
  rejected_seconds: number;
}

export interface LeaveBreakdown {
  today: LeaveBreakdownPeriod;
  week: LeaveBreakdownPeriod;
  month?: LeaveBreakdownPeriod;
  range?: LeaveBreakdownPeriod;
}

export interface ReportDateRange {
  start_date: string;
  end_date: string;
}

export interface EmployeeReportBreakdown {
  user_id: number;
  name: string;
  team_id?: number | null;
  team_name?: string | null;
  hours_in_range_seconds: number;
  utilization_percent: number;
  has_active_timer: boolean;
}

export interface PersonalTimeReport {
  hours_today_seconds: number;
  hours_week_seconds: number;
  hours_month_seconds: number;
  hours_in_range_seconds?: number;
  date_range?: ReportDateRange;
  leave_breakdown?: LeaveBreakdown;
  overtime_summary?: OvertimeSummary;
}

export interface LeaveContext {
  can_request?: boolean;
  reason?: string | null;
  team?: { id: number; name: string } | null;
  manager?: { id: number; name: string } | null;
  can_manage?: boolean;
  employees?: { id: number; name: string }[];
  teams?: { id: number; name: string }[];
  team_members?: {
    id: number;
    name: string;
    team_id: number;
    team_name: string;
  }[];
}

export interface ManualTimeProjectOption {
  id: number;
  name: string;
  client_name?: string | null;
}

export interface ManualTimeContext {
  can_create?: boolean;
  reason?: string | null;
  can_create_self?: boolean;
  reason_self?: string | null;
  self_projects?: ManualTimeProjectOption[];
  team?: { id: number; name: string } | null;
  managers?: { id: number; name: string }[];
  projects?: ManualTimeProjectOption[];
  employees?: { id: number; name: string }[];
  team_members?: {
    id: number;
    name: string;
    team_id: number;
    team_name: string;
    projects: ManualTimeProjectOption[];
  }[];
}

export interface TimeByProject {
  project_id: number | null;
  project_name: string;
  client_name?: string | null;
  total_duration: number;
  entries_count: number;
}

export interface TimeTodayResponse {
  data: TimeEntry[];
  meta: {
    date: string;
    total_duration: number;
    active_timer: TimeEntry | null;
    by_project: TimeByProject[];
  };
}

export interface TimeActionResponse {
  message: string;
  entry: TimeEntry;
}

export interface WorkTeamMember {
  id: number;
  name: string;
  email: string;
  role?: string;
}

export interface WorkTeam {
  id: number;
  name: string;
  manager_id: number | null;
  manager_name?: string | null;
  manager_email?: string | null;
  members_count?: number;
  members?: WorkTeamMember[];
  active_projects_count?: number;
  team_hours_today_seconds?: number;
  created_at?: string;
}

export interface TeamUtilization {
  team_id: number;
  team_name: string;
  tracked_seconds: number;
  expected_seconds: number;
  utilization_percent: number;
}

export interface TeamMemberBreakdown {
  user_id: number;
  name: string;
  hours_today_seconds: number;
  hours_week_seconds: number;
  hours_in_range_seconds?: number;
  utilization_percent?: number;
  has_active_timer: boolean;
}

export interface ManagerTeamReport {
  team_id: number;
  team_name: string;
  hours_today_seconds: number;
  hours_week_seconds: number;
  hours_in_range_seconds?: number;
  utilization_percent: number;
  range_utilization_percent?: number;
  active_timers: number;
  active_projects: number;
  member_breakdown: TeamMemberBreakdown[];
  leave_breakdown?: {
    today: LeaveBreakdownPeriod;
    week: LeaveBreakdownPeriod;
    range?: LeaveBreakdownPeriod;
  };
}

export interface OrganizationReport {
  date_range?: ReportDateRange;
  hours_today_seconds: number;
  hours_week_seconds: number;
  hours_month_seconds: number;
  hours_in_range_seconds?: number;
  active_timers: number;
  active_employees: number;
  active_projects: number;
  organization_utilization_percent: number;
  range_utilization_percent?: number;
  team_utilization: TeamUtilization[];
  employee_breakdown?: EmployeeReportBreakdown[];
  overtime_summary?: OvertimeSummary;
  overtime_settings?: OvertimeSettingsMeta;
  employee_overtime_breakdown?: EmployeeOvertimeBreakdown[];
  leave_breakdown?: LeaveBreakdown;
}

export interface ManagerReport {
  date_range?: ReportDateRange;
  teams: ManagerTeamReport[];
  team_count: number;
  overtime_summary?: OvertimeSummary;
}

export interface ProjectReportContribution {
  user_id: number;
  name: string;
  total_seconds: number | string;
}

export interface ProjectTeamContribution {
  team_id: number;
  team_name: string;
  total_seconds: number;
}

export interface ProjectReport {
  project_id: number;
  project_name: string;
  total_tracked_seconds: number;
  hours_week_seconds: number;
  hours_month_seconds: number;
  hours_today_seconds: number;
  utilization_percent: number;
  team_contributions: ProjectTeamContribution[];
  employee_contributions: ProjectReportContribution[];
}

export interface EmployeeDashboard {
  role: "employee";
  date_range?: ReportDateRange;
  team: { id: number; name: string } | null;
  personal_report: PersonalTimeReport;
  active_timer: TimeEntry | null;
  today_total_seconds: number;
  week_total_seconds: number;
  week_utilization_percent: number;
  range_total_seconds?: number;
  range_utilization_percent?: number;
  overtime_summary?: OvertimeSummary;
  recent_sessions: TimeEntry[];
  assigned_projects: Project[];
}

export interface ManagerDashboard {
  role: "manager";
  date_range?: ReportDateRange;
  teams: ManagerTeamReport[];
  team_count: number;
  summary: {
    hours_today_seconds: number;
    hours_in_range_seconds?: number;
    team_utilization_percent: number;
    active_projects: number;
    active_timers: number;
  };
  overtime_summary?: OvertimeSummary;
}

export interface AdminDashboard {
  role: "admin" | "sub_admin";
  date_range?: ReportDateRange;
  team_count: number;
  employee_count: number;
  unassigned_employees: number;
  active_projects: number;
  active_employees: number;
  today_tracked_seconds: number;
  week_tracked_seconds: number;
  month_tracked_seconds: number;
  range_tracked_seconds?: number;
  running_timers: number;
  organization_utilization_percent: number;
  range_utilization_percent?: number;
  team_utilization: TeamUtilization[];
  employee_breakdown?: EmployeeReportBreakdown[];
  overtime_summary?: OvertimeSummary;
  teams: WorkTeam[];
}

export interface PlatformDashboard {
  role: "super_admin";
  organizations_total: number;
  organizations_active: number;
  organizations_suspended: number;
  tenant_users_total: number;
}

export interface PlatformOrganization {
  id: number;
  name: string;
  slug: string;
  status: "active" | "suspended" | "trial";
  employee_count: number;
  admin_user_id?: number | null;
  admin_name?: string | null;
  admin_email?: string | null;
  created_at?: string | null;
}

export type DashboardData = EmployeeDashboard | ManagerDashboard | AdminDashboard;

export type SalaryType = "hourly" | "monthly";

export interface PayrollVaultStatus {
  pin_configured: boolean;
  vault_unlocked: boolean;
  unlock_expires_at: string | null;
  requires_pin_on_employee_create: boolean;
  requires_pin_setup: boolean;
  requires_pin_each_access?: boolean;
}

export interface SalaryContract {
  id: number;
  user_id: number;
  user_name?: string | null;
  salary_type: SalaryType;
  has_salary: boolean;
  hourly_rate?: null;
  monthly_salary?: null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export type PayrollRunStatus = "draft" | "finalized" | "locked";

export type PayrollDeductionMode = "percentage" | "fbr_slabs";

export interface OvertimeSummary {
  approved_seconds: number;
  pending_count: number;
  pending_seconds?: number;
}

export interface OvertimeSettingsMeta {
  enabled: boolean;
  rate_percentage: string | null;
}

export interface EmployeeOvertimeBreakdown {
  user_id: number;
  name?: string;
  approved_seconds: number;
  pending_seconds?: number;
}

export type OvertimeRequestStatus = "pending" | "approved" | "rejected";

export interface OvertimeRequest {
  id: number;
  user_id: number;
  user_name?: string;
  project_id: number;
  project_name?: string;
  manager_id?: number | null;
  manager_name?: string | null;
  work_date: string;
  duration_seconds: number;
  reason: string;
  status: OvertimeRequestStatus;
  reviewed_by?: number | null;
  reviewer_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
}

export interface OvertimeContext {
  can_create?: boolean;
  can_create_self?: boolean;
  reason?: string | null;
  reason_self?: string | null;
  team?: { id: number; name: string } | null;
  manager?: { id: number; name: string } | null;
  projects?: { id: number; name: string; client_name: string }[];
  self_projects?: { id: number; name: string; client_name: string }[];
}

export interface OrganizationPayrollSettings {
  organization_id: number;
  working_days_per_month: number;
  working_hours_per_day: number;
  expected_monthly_hours: number;
  deduction_mode: PayrollDeductionMode;
  income_tax_percent: string | null;
  eobi_percent: string | null;
  social_security_percent: string | null;
  custom_deduction_percent: string | null;
  overtime_enabled: boolean;
  overtime_rate_percentage: string | null;
  financial_data_masked?: boolean;
  updated_at?: string | null;
}

export interface PayrollRunEmployeeRecord {
  id: number;
  payroll_run_id: number;
  user_id: number;
  user_name?: string;
  salary_type: SalaryType;
  payable_hours_seconds: number;
  regular_hours_seconds?: number;
  regular_pay_snapshot: string | null;
  overtime_hours_seconds?: number;
  overtime_rate_percent_snapshot: string | null;
  overtime_pay_snapshot: string | null;
  hourly_equivalent_snapshot: string | null;
  gross_salary_snapshot: string | null;
  deduction_mode_snapshot: PayrollDeductionMode;
  income_tax_percent_snapshot: string | null;
  eobi_percent_snapshot: string | null;
  social_security_percent_snapshot: string | null;
  custom_deduction_percent_snapshot: string | null;
  income_tax_snapshot: string | null;
  eobi_snapshot: string | null;
  social_security_snapshot: string | null;
  custom_deduction_snapshot: string | null;
  bonuses_snapshot: string | null;
  net_salary_snapshot: string | null;
  financial_data_masked?: boolean;
}

export interface PayrollRunEntry {
  id: number;
  payroll_run_id: number;
  time_entry_id: number;
  user_id: number;
  user_name?: string;
  entry_type: TimeEntryType;
  duration_seconds: number;
  hourly_rate_snapshot: string | null;
  pay_snapshot: string;
}

export interface PayrollRun {
  id: number;
  organization_id: number;
  period_start: string;
  period_end: string;
  status: PayrollRunStatus;
  total_hours_snapshot: number;
  total_pay_snapshot: string | null;
  total_gross_snapshot?: string | null;
  total_net_snapshot: string | null;
  financial_data_masked?: boolean;
  created_by: number;
  created_by_name?: string;
  finalized_by?: number | null;
  finalized_by_name?: string | null;
  finalized_at?: string | null;
  locked_by?: number | null;
  locked_by_name?: string | null;
  locked_at?: string | null;
  created_at: string;
  updated_at: string;
  entries?: PayrollRunEntry[];
  employee_records?: PayrollRunEmployeeRecord[];
  entry_count?: number;
  employee_record_count?: number;
}
