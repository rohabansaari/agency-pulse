import type { ExportColumn } from "@/lib/export";

export const EMPLOYEES_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "team", label: "Team" },
  { key: "manager", label: "Manager" },
  { key: "status", label: "Status" },
  { key: "join_date", label: "Join Date" },
  { key: "last_activity", label: "Last Activity" },
];

export const TEAMS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "team_name", label: "Team Name" },
  { key: "manager_name", label: "Manager Name" },
  { key: "total_members", label: "Total Members" },
  { key: "total_projects", label: "Total Projects" },
  { key: "active_status", label: "Active Status" },
];

export const PROJECTS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "project_name", label: "Project Name" },
  { key: "client", label: "Client" },
  { key: "status", label: "Status" },
  { key: "assigned_team", label: "Assigned Team" },
  { key: "members_count", label: "Members Count" },
  { key: "created_date", label: "Created Date" },
];

export const TIME_TRACKING_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "employee_name", label: "Employee Name" },
  { key: "project_name", label: "Project Name" },
  { key: "date", label: "Date" },
  { key: "hours_worked", label: "Hours Worked" },
  { key: "entry_type", label: "Entry Type" },
  { key: "status", label: "Status" },
];

export const MANUAL_TIME_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "employee_name", label: "Employee Name" },
  { key: "project_name", label: "Project Name" },
  { key: "date", label: "Date" },
  { key: "hours_worked", label: "Hours Worked" },
  { key: "entry_type", label: "Entry Type" },
  { key: "status", label: "Status" },
];

export const LEAVE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "employee_name", label: "Employee Name" },
  { key: "date", label: "Date" },
  { key: "duration", label: "Duration" },
  { key: "status", label: "Status" },
  { key: "team", label: "Team" },
  { key: "source", label: "Source" },
];

export const OVERTIME_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "employee_name", label: "Employee Name" },
  { key: "date", label: "Date" },
  { key: "project_name", label: "Project Name" },
  { key: "duration", label: "Duration" },
  { key: "status", label: "Status" },
];

export const PAYROLL_RUNS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "employee_name", label: "Employee Name" },
  { key: "period", label: "Period" },
  { key: "total_hours", label: "Total Hours" },
  { key: "overtime_hours", label: "Overtime Hours" },
  { key: "deductions", label: "Deductions" },
  { key: "gross_pay", label: "Gross Pay" },
  { key: "net_pay", label: "Net Pay" },
  { key: "payroll_status", label: "Payroll Status" },
];

export const PAYROLL_SUMMARY_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "metric", label: "Metric" },
  { key: "value", label: "Value" },
];
