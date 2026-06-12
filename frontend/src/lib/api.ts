import { clearToken, getOrganizationId, getToken, setOrganizationId, setToken, clearOrganizationId } from "./auth";
import { getPayrollPin } from "./payroll-pin";
import type {
  ApiValidationError,
  AuthResponse,
  DashboardData,
  ManagerReport,
  MeResponse,
  OrganizationReport,
  PersonalTimeReport,
  ManualTimeContext,
  LeaveContext,
  Project,
  ProjectReport,
  ProjectAssignee,
  ProjectMember,
  ProjectStatus,
  TeamMember,
  TimeActionResponse,
  TimeEntry,
  TimeTodayResponse,
  User,
  UserRole,
  MemberStatus,
  WorkTeam,
  PayrollRun,
  OrganizationPayrollSettings,
  SalaryContract,
  PayrollVaultStatus,
  ReportDateRange,
  OvertimeContext,
  OvertimeRequest,
  EmployeeProfile,
  PlatformDashboard,
  PlatformOrganization,
  CsvImportResult,
  OnboardingStatus,
  PaginatedResponse,
  ScreenshotRecord,
  PayrollComponent,
  PayrollComponentType,
  PayrollComponentValueMode,
  SalaryType,
  SalaryAdvanceRequest,
  LeaveBalance,
  LeaveBalanceEntry,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

/** Stateless API client — Bearer token + tenant header. */

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, body: ApiValidationError) {
    super(body.message ?? "Request failed");
    this.status = status;
    this.errors = body.errors;
  }
}

type ApiFetchOptions = RequestInit & {
  token?: string | null;
  auth?: boolean;
  tenant?: boolean;
  payrollPin?: boolean;
};

function payrollPinHeaders(): Record<string, string> {
  const pin = getPayrollPin();
  return pin ? { "X-Payroll-Pin": pin } : {};
}

async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, auth = true, tenant = true, payrollPin = false, headers, ...rest } = options;

  const authToken =
    token !== undefined ? token : auth ? getToken() : null;

  const organizationId = tenant ? getOrganizationId() : null;

  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(organizationId ? { "X-Organization-Id": String(organizationId) } : {}),
      ...(payrollPin ? payrollPinHeaders() : {}),
      ...headers,
    },
  });

  const data = (await response.json().catch(() => ({}))) as T &
    ApiValidationError;

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
}

function persistAuthSession(response: AuthResponse): void {
  setToken(response.token);

  if (response.current_organization_id) {
    setOrganizationId(response.current_organization_id);
  } else {
    clearOrganizationId();
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    tenant: false,
    body: JSON.stringify({ email, password }),
  });

  persistAuthSession(response);

  return response;
}

export async function fetchMe(): Promise<MeResponse> {
  const response = await apiFetch<MeResponse>("/auth/me", {
    tenant: false,
  });

  if (response.current_organization_id) {
    setOrganizationId(response.current_organization_id);
  } else {
    clearOrganizationId();
  }

  return response;
}

export async function fetchUser(): Promise<User> {
  const response = await fetchMe();
  return response.user;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ message: string }>("/auth/logout", {
      method: "POST",
      tenant: false,
    });
  } finally {
    clearToken();
  }
}

export async function fetchProjects(includeArchived = false): Promise<Project[]> {
  const query = includeArchived ? "?include_archived=1" : "";
  const response = await apiFetch<Project[]>(`/projects${query}`);
  return response;
}

export async function fetchProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`);
}

export async function createProject(data: {
  name: string;
  client_name: string;
  description?: string | null;
  hourly_rate?: number | null;
}): Promise<Project> {
  const response = await apiFetch<{ project: Project }>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.project;
}

export async function updateProject(
  id: number,
  data: Partial<{
    name: string;
    client_name: string;
    description: string | null;
    hourly_rate: number | null;
    status: ProjectStatus;
  }>,
): Promise<Project> {
  const response = await apiFetch<{ project: Project }>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return response.project;
}

export async function updateProjectStatus(
  id: number,
  status: ProjectStatus,
): Promise<Project> {
  const response = await apiFetch<{ project: Project }>(
    `/projects/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  return response.project;
}

export async function fetchProjectMembers(
  projectId: number,
): Promise<ProjectMember[]> {
  return apiFetch<ProjectMember[]>(`/projects/${projectId}/members`);
}

export async function assignProjectMember(
  projectId: number,
  userId: number,
): Promise<void> {
  await apiFetch(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function removeProjectMember(
  projectId: number,
  userId: number,
): Promise<void> {
  await apiFetch(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function fetchProjectAssignees(
  projectId: number,
): Promise<ProjectAssignee[]> {
  return apiFetch<ProjectAssignee[]>(`/projects/${projectId}/assignees`);
}

export async function assignProjectEmployee(
  projectId: number,
  userId: number,
): Promise<ProjectAssignee> {
  const response = await apiFetch<{ assignee: ProjectAssignee }>(
    `/projects/${projectId}/assign`,
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    },
  );
  return response.assignee;
}

export async function assignProjectEmployees(
  projectId: number,
  userIds: number[],
): Promise<{ message: string; assigned: number; skipped: number }> {
  return apiFetch(`/projects/${projectId}/assign-bulk`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export async function unassignProjectEmployee(
  projectId: number,
  userId: number,
): Promise<void> {
  await apiFetch(`/projects/${projectId}/unassign/${userId}`, {
    method: "DELETE",
  });
}

export async function fetchWorkTeams(): Promise<WorkTeam[]> {
  return apiFetch<WorkTeam[]>("/teams");
}

export async function createWorkTeam(name: string): Promise<WorkTeam> {
  const response = await apiFetch<{ team: WorkTeam }>("/teams", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return response.team;
}

export async function assignTeamManager(
  teamId: number,
  managerId: number,
): Promise<WorkTeam> {
  const response = await apiFetch<{ team: WorkTeam }>(
    `/teams/${teamId}/assign-manager`,
    {
      method: "POST",
      body: JSON.stringify({ manager_id: managerId }),
    },
  );
  return response.team;
}

export async function addTeamMember(
  teamId: number,
  userId: number,
): Promise<WorkTeam> {
  const response = await apiFetch<{ team: WorkTeam }>(
    `/teams/${teamId}/add-member`,
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    },
  );
  return response.team;
}

export async function removeTeamMember(
  teamId: number,
  userId: number,
): Promise<WorkTeam> {
  const response = await apiFetch<{ team: WorkTeam }>(
    `/teams/${teamId}/remove-member/${userId}`,
    { method: "DELETE" },
  );
  return response.team;
}

export async function fetchTeam(): Promise<TeamMember[]> {
  return apiFetch<TeamMember[]>("/team");
}

export async function createEmployee(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  salary_type: SalaryType;
  hourly_rate?: number;
  monthly_salary?: number;
  payroll_pin?: string;
  payroll_pin_confirmation?: string;
}): Promise<TeamMember> {
  const response = await apiFetch<{ member: TeamMember }>("/team/create-employee", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.member;
}

export async function resetEmployeePassword(
  userId: number,
  newPassword: string,
): Promise<void> {
  await apiFetch(`/team/${userId}/reset-password`, {
    method: "PATCH",
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export async function inviteTeamMember(data: {
  name: string;
  email: string;
  role: UserRole;
}): Promise<TeamMember> {
  const response = await apiFetch<{ member: TeamMember }>("/team/invite", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.member;
}

export async function updateTeamMember(
  memberId: number,
  data: Partial<{ role: UserRole; status: MemberStatus; name: string }>,
): Promise<TeamMember> {
  const response = await apiFetch<{ member: TeamMember }>(
    `/team/${memberId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
  return response.member;
}

function dateRangeQuery(range?: ReportDateRange): string {
  if (!range?.start_date || !range?.end_date) {
    return "";
  }

  const params = new URLSearchParams({
    start_date: range.start_date,
    end_date: range.end_date,
  });

  return `?${params.toString()}`;
}

export async function fetchPlatformDashboard(): Promise<PlatformDashboard> {
  return apiFetch<PlatformDashboard>("/platform/dashboard", { tenant: false });
}

export async function fetchPlatformOrganizations(): Promise<PlatformOrganization[]> {
  const response = await apiFetch<{ organizations: PlatformOrganization[] }>(
    "/platform/organizations",
    { tenant: false },
  );
  return response.organizations;
}

export async function createPlatformOrganization(data: {
  organization_name: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
}): Promise<{ message: string; organization: PlatformOrganization }> {
  return apiFetch<{ message: string; organization: PlatformOrganization }>(
    "/platform/organizations",
    {
      method: "POST",
      tenant: false,
      body: JSON.stringify(data),
    },
  );
}

export async function updatePlatformOrganization(
  organizationId: number,
  data: {
    admin_email?: string;
    status?: PlatformOrganization["status"];
  },
): Promise<{ message: string; organization: PlatformOrganization }> {
  return apiFetch<{ message: string; organization: PlatformOrganization }>(
    `/platform/organizations/${organizationId}`,
    {
      method: "PATCH",
      tenant: false,
      body: JSON.stringify(data),
    },
  );
}

export async function deletePlatformOrganization(
  organizationId: number,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/platform/organizations/${organizationId}`, {
    method: "DELETE",
    tenant: false,
  });
}

export async function updateSuperAdminPassword(data: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/platform/password", {
    method: "PATCH",
    tenant: false,
    body: JSON.stringify(data),
  });
}

export async function fetchDashboard(range?: ReportDateRange): Promise<DashboardData> {
  return apiFetch<DashboardData>(`/dashboard${dateRangeQuery(range)}`);
}

export async function fetchOrganizationReport(range?: ReportDateRange): Promise<OrganizationReport> {
  return apiFetch<OrganizationReport>(`/reports/organization${dateRangeQuery(range)}`);
}

export async function fetchManagerReport(range?: ReportDateRange): Promise<ManagerReport> {
  return apiFetch<ManagerReport>(`/reports/manager${dateRangeQuery(range)}`);
}

export async function fetchProjectReport(
  projectId: number,
  range?: ReportDateRange,
): Promise<ProjectReport> {
  return apiFetch<ProjectReport>(`/reports/projects/${projectId}${dateRangeQuery(range)}`);
}

export async function startTimer(projectId?: number | null): Promise<TimeActionResponse> {
  return apiFetch<TimeActionResponse>("/time/start", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId ?? null,
    }),
  });
}

export async function stopTimer(): Promise<TimeActionResponse> {
  return apiFetch<TimeActionResponse>("/time/stop", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchTodayTime(): Promise<TimeTodayResponse> {
  return apiFetch<TimeTodayResponse>("/time/today");
}

export async function fetchPersonalTimeReport(): Promise<PersonalTimeReport> {
  return apiFetch<PersonalTimeReport>("/time/personal-report");
}

export async function fetchManualTimeContext(): Promise<ManualTimeContext> {
  return apiFetch<ManualTimeContext>("/time/manual/context");
}

export async function fetchManualTimeEntries(): Promise<TimeEntry[]> {
  return apiFetch<TimeEntry[]>("/time/manual");
}

export async function createManualTimeEntry(data: {
  date: string;
  duration: number;
  description: string;
  project_id: number;
  manager_id?: number;
  user_id?: number;
  team_id?: number;
  auto_approve?: boolean;
  for_self?: boolean;
}): Promise<TimeActionResponse> {
  return apiFetch<TimeActionResponse>("/time/manual", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchPendingManualEntries(): Promise<TimeEntry[]> {
  return apiFetch<TimeEntry[]>("/time/manual/pending");
}

export async function approveManualTimeEntry(id: number): Promise<TimeActionResponse> {
  return apiFetch<TimeActionResponse>(`/time/manual/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectManualTimeEntry(id: number): Promise<TimeActionResponse> {
  return apiFetch<TimeActionResponse>(`/time/manual/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchOvertimeContext(): Promise<OvertimeContext> {
  return apiFetch<OvertimeContext>("/time/overtime/context");
}

export async function fetchOvertimeRequests(): Promise<OvertimeRequest[]> {
  return apiFetch<OvertimeRequest[]>("/time/overtime");
}

export async function submitOvertimeRequest(data: {
  date: string;
  duration: number;
  reason: string;
  project_id: number;
  for_self?: boolean;
}): Promise<{ message: string; request: OvertimeRequest }> {
  return apiFetch<{ message: string; request: OvertimeRequest }>("/time/overtime", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchPendingOvertimeRequests(): Promise<OvertimeRequest[]> {
  return apiFetch<OvertimeRequest[]>("/time/overtime/pending");
}

export async function approveOvertimeRequest(id: number): Promise<{ message: string; request: OvertimeRequest }> {
  return apiFetch<{ message: string; request: OvertimeRequest }>(`/time/overtime/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectOvertimeRequest(
  id: number,
  rejection_reason?: string,
): Promise<{ message: string; request: OvertimeRequest }> {
  return apiFetch<{ message: string; request: OvertimeRequest }>(`/time/overtime/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejection_reason }),
  });
}

export async function fetchLeaveContext(): Promise<LeaveContext> {
  return apiFetch<LeaveContext>("/time/leave/context");
}

export async function fetchLeaveEntries(): Promise<TimeEntry[]> {
  return apiFetch<TimeEntry[]>("/time/leave");
}

export async function fetchPendingLeaveEntries(): Promise<TimeEntry[]> {
  return apiFetch<TimeEntry[]>("/time/leave/pending");
}

export async function requestLeave(data: {
  date?: string;
  start_date?: string;
  end_date?: string;
  reason: string;
  user_id?: number;
  team_id?: number;
  require_approval?: boolean;
}): Promise<{ message: string; entries: TimeEntry[] }> {
  return apiFetch<{ message: string; entries: TimeEntry[] }>("/time/leave", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function approveLeaveEntry(id: number): Promise<TimeActionResponse> {
  return apiFetch<TimeActionResponse>(`/time/leave/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectLeaveEntry(id: number): Promise<TimeActionResponse> {
  return apiFetch<TimeActionResponse>(`/time/leave/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function updateLeaveEntry(
  id: number,
  data: {
    reason?: string;
    status?: "pending" | "approved" | "rejected";
    date?: string;
    duration?: number;
    user_id?: number;
    manager_id?: number;
  },
): Promise<TimeActionResponse> {
  return apiFetch<TimeActionResponse>(`/time/leave/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchPayrollVaultStatus(): Promise<PayrollVaultStatus> {
  return apiFetch<PayrollVaultStatus>("/payroll/vault/status");
}

export async function initializePayrollPin(
  payroll_pin: string,
  payroll_pin_confirmation: string,
): Promise<{ message: string; status: PayrollVaultStatus }> {
  return apiFetch<{ message: string; status: PayrollVaultStatus }>("/payroll/vault/initialize", {
    method: "POST",
    body: JSON.stringify({ payroll_pin, payroll_pin_confirmation }),
  });
}

export async function unlockPayrollVault(
  payroll_pin: string,
): Promise<{ message: string; status: PayrollVaultStatus; vault_unlocked: boolean }> {
  return apiFetch("/payroll/vault/unlock", {
    method: "POST",
    body: JSON.stringify({ payroll_pin }),
  });
}

export async function fetchPayrollSettings(): Promise<OrganizationPayrollSettings> {
  return apiFetch<OrganizationPayrollSettings>("/payroll/settings", { payrollPin: true });
}

export async function updatePayrollSettings(data: {
  working_days_per_month?: number;
  working_hours_per_day?: number;
  income_tax_percent?: number;
  eobi_percent?: number;
  social_security_percent?: number;
  custom_deduction_percent?: number;
  overtime_enabled?: boolean;
  overtime_rate_percentage?: number;
}): Promise<{ message: string; settings: OrganizationPayrollSettings }> {
  return apiFetch<{ message: string; settings: OrganizationPayrollSettings }>(
    "/payroll/settings",
    {
      method: "PATCH",
      body: JSON.stringify(data),
      payrollPin: true,
    },
  );
}

export async function fetchPayrollComponents(): Promise<PayrollComponent[]> {
  return apiFetch<PayrollComponent[]>("/payroll/components", { payrollPin: true });
}

export async function createPayrollComponent(data: {
  name: string;
  type: PayrollComponentType;
  value_mode: PayrollComponentValueMode;
  value: number;
  is_active?: boolean;
}): Promise<{ message: string; component: PayrollComponent }> {
  return apiFetch("/payroll/components", {
    method: "POST",
    body: JSON.stringify(data),
    payrollPin: true,
  });
}

export async function updatePayrollComponent(
  id: number,
  data: Partial<{
    name: string;
    type: PayrollComponentType;
    value_mode: PayrollComponentValueMode;
    value: number;
    is_active: boolean;
  }>,
): Promise<{ message: string; component: PayrollComponent }> {
  return apiFetch(`/payroll/components/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
    payrollPin: true,
  });
}

export async function deletePayrollComponent(id: number): Promise<{ message: string }> {
  return apiFetch(`/payroll/components/${id}`, {
    method: "DELETE",
    payrollPin: true,
  });
}

export async function fetchEmployeeProfile(userId: number): Promise<EmployeeProfile> {
  return apiFetch<EmployeeProfile>(`/team/${userId}/profile`);
}

export async function fetchSalaryContractStatus(
  userId: number,
): Promise<{ has_salary: boolean; salary_type: "hourly" | "monthly" | null }> {
  return apiFetch(`/payroll/salary-contracts/${userId}/status`, { payrollPin: true });
}

export async function updateSalaryContract(
  userId: number,
  data: {
    salary_type: "hourly" | "monthly";
    hourly_rate?: number;
    monthly_salary?: number;
    effective_from?: string;
  },
): Promise<{ message: string; contract: SalaryContract }> {
  return apiFetch<{ message: string; contract: SalaryContract }>(
    `/payroll/salary-contracts/${userId}`,
    {
      method: "POST",
      body: JSON.stringify(data),
      payrollPin: true,
    },
  );
}

export async function fetchPayrollRuns(range?: ReportDateRange): Promise<PayrollRun[]> {
  return apiFetch<PayrollRun[]>(`/payroll-runs${dateRangeQuery(range)}`, { payrollPin: true });
}

export async function fetchPayrollRun(id: number): Promise<PayrollRun> {
  return apiFetch<PayrollRun>(`/payroll-runs/${id}`, { payrollPin: true });
}

export async function createPayrollRun(data: {
  period_start: string;
  period_end: string;
}): Promise<{ message: string; payroll_run: PayrollRun }> {
  return apiFetch<{ message: string; payroll_run: PayrollRun }>("/payroll-runs", {
    method: "POST",
    body: JSON.stringify(data),
    payrollPin: true,
  });
}

export async function finalizePayrollRun(
  id: number,
): Promise<{ message: string; payroll_run: PayrollRun }> {
  return apiFetch<{ message: string; payroll_run: PayrollRun }>(
    `/payroll-runs/${id}/finalize`,
    { method: "POST", body: JSON.stringify({}), payrollPin: true },
  );
}

export async function updatePayrollRun(
  id: number,
  data: { period_start?: string; period_end?: string },
): Promise<{ message: string; payroll_run: PayrollRun }> {
  return apiFetch<{ message: string; payroll_run: PayrollRun }>(
    `/payroll-runs/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
      payrollPin: true,
    },
  );
}

export async function deletePayrollRun(id: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/payroll-runs/${id}`, {
    method: "DELETE",
    payrollPin: true,
  });
}

export async function recalculatePayrollRun(
  id: number,
): Promise<{ message: string; payroll_run: PayrollRun }> {
  return apiFetch<{ message: string; payroll_run: PayrollRun }>(
    `/payroll-runs/${id}/recalculate`,
    { method: "POST", body: JSON.stringify({}), payrollPin: true },
  );
}

export async function lockPayrollRun(
  id: number,
): Promise<{ message: string; payroll_run: PayrollRun }> {
  return apiFetch<{ message: string; payroll_run: PayrollRun }>(
    `/payroll-runs/${id}/lock`,
    { method: "POST", body: JSON.stringify({}), payrollPin: true },
  );
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  return apiFetch<OnboardingStatus>("/onboarding/status");
}

export async function updateOnboardingOrganization(data: {
  name: string;
  timezone?: string | null;
  logo_url?: string | null;
  website?: string | null;
}): Promise<{ message: string; status: OnboardingStatus }> {
  return apiFetch<{ message: string; status: OnboardingStatus }>("/onboarding/organization", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateOnboardingStep(step: number): Promise<{ status: OnboardingStatus }> {
  return apiFetch<{ status: OnboardingStatus }>("/onboarding/step", {
    method: "PATCH",
    body: JSON.stringify({ step }),
  });
}

export async function skipOnboardingStep(step: number): Promise<{ status: OnboardingStatus }> {
  return apiFetch<{ status: OnboardingStatus }>("/onboarding/skip-step", {
    method: "POST",
    body: JSON.stringify({ step }),
  });
}

export async function changePayrollPin(data: {
  current_pin: string;
  payroll_pin: string;
  payroll_pin_confirmation: string;
}): Promise<{ message: string; status: PayrollVaultStatus }> {
  return apiFetch<{ message: string; status: PayrollVaultStatus }>("/payroll/vault/change-pin", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createOnboardingEmployee(data: {
  name: string;
  email: string;
  salary: number;
  salary_type: "monthly" | "hourly";
  role?: UserRole;
}): Promise<{ message: string; status: OnboardingStatus }> {
  return apiFetch<{ message: string; status: OnboardingStatus }>("/onboarding/employees", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function importOnboardingEmployees(
  file: File,
): Promise<{
  message: string;
  created: number;
  failed_count: number;
  total: number;
  failed: { row: number; data: Record<string, string>; errors: string[] }[];
  results: CsvImportResult[];
  status: OnboardingStatus;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getToken();
  const organizationId = getOrganizationId();

  const response = await fetch(`${API_BASE}/onboarding/employees/import`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { "X-Organization-Id": String(organizationId) } : {}),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
}

export async function completeOnboarding(): Promise<{ message: string; status: OnboardingStatus }> {
  return apiFetch<{ message: string; status: OnboardingStatus }>("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type EmployeeCsvImportResponse = {
  message: string;
  created: number;
  failed_count: number;
  total: number;
  failed: { row: number; data: Record<string, string>; errors: string[] }[];
  results: CsvImportResult[];
  status?: OnboardingStatus;
};

export async function importTeamEmployees(file: File): Promise<EmployeeCsvImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getToken();
  const organizationId = getOrganizationId();

  const response = await fetch(`${API_BASE}/team/import-employees`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { "X-Organization-Id": String(organizationId) } : {}),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
}

export function teamSampleCsvUrl(): string {
  return `${API_BASE}/team/import-employees/sample.csv`;
}

export async function updatePassword(data: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/password", {
    method: "PATCH",
    tenant: false,
    body: JSON.stringify(data),
  });
}

export async function resolvePostAuthPath(role: UserRole): Promise<string> {
  if (role === "super_admin") {
    return "/platform";
  }

  if (role === "admin") {
    try {
      const status = await fetchOnboardingStatus();
      if (status.requires_onboarding) {
        return "/onboarding";
      }
    } catch {
      return "/dashboard";
    }
  }

  return "/dashboard";
}

export function onboardingSampleCsvUrl(): string {
  return `${API_BASE}/onboarding/employees/sample.csv`;
}

export function formatApiErrors(errors?: Record<string, string[]>): string {
  if (!errors) {
    return "";
  }

  return Object.values(errors).flat().join(" ");
}

export interface ScreenshotAgentStatus {
  connected: boolean;
  last_heartbeat_at: string | null;
  last_upload_at: string | null;
}

export async function fetchScreenshotAgentStatus(): Promise<ScreenshotAgentStatus> {
  return apiFetch<ScreenshotAgentStatus>("/screenshots/agent-status");
}

export async function fetchScreenshots(params: {
  user_id?: number;
  session_id?: string;
  range?: ReportDateRange;
  page?: number;
  per_page?: number;
} = {}): Promise<PaginatedResponse<ScreenshotRecord>> {
  const search = new URLSearchParams();
  if (params.user_id) search.set("user_id", String(params.user_id));
  if (params.session_id) search.set("session_id", params.session_id);
  if (params.range?.start_date) search.set("start_date", params.range.start_date);
  if (params.range?.end_date) search.set("end_date", params.range.end_date);
  if (params.page) search.set("page", String(params.page));
  if (params.per_page) search.set("per_page", String(params.per_page));

  const query = search.toString();
  return apiFetch<PaginatedResponse<ScreenshotRecord>>(
    `/screenshots${query ? `?${query}` : ""}`,
  );
}

export async function fetchSalaryAdvances(): Promise<SalaryAdvanceRequest[]> {
  return apiFetch<SalaryAdvanceRequest[]>("/hr/advances");
}

export async function fetchPendingSalaryAdvances(): Promise<SalaryAdvanceRequest[]> {
  return apiFetch<SalaryAdvanceRequest[]>("/hr/advances/pending");
}

export async function createSalaryAdvance(data: {
  amount: number;
  reason?: string;
}): Promise<{ message: string; request: SalaryAdvanceRequest }> {
  return apiFetch("/hr/advances", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function approveSalaryAdvance(
  id: number,
): Promise<{ message: string; request: SalaryAdvanceRequest }> {
  return apiFetch(`/hr/advances/${id}/approve`, { method: "POST" });
}

export async function rejectSalaryAdvance(
  id: number,
): Promise<{ message: string; request: SalaryAdvanceRequest }> {
  return apiFetch(`/hr/advances/${id}/reject`, { method: "POST" });
}

export async function fetchMyLeaveBalance(): Promise<{ balance: LeaveBalance }> {
  return apiFetch<{ balance: LeaveBalance }>("/hr/leave-balance");
}

export async function fetchLeaveBalances(): Promise<{ balances: LeaveBalanceEntry[] }> {
  return apiFetch<{ balances: LeaveBalanceEntry[] }>("/hr/leave-balances");
}

export async function updateLeaveLimit(
  userId: number,
  annual_limit_days: number,
): Promise<{ message: string; balance: LeaveBalance }> {
  return apiFetch(`/hr/leave-balances/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ annual_limit_days }),
  });
}

export async function resetLeaveBalance(
  userId: number,
): Promise<{ message: string; balance: LeaveBalance }> {
  return apiFetch(`/hr/leave-balances/${userId}/reset`, { method: "POST" });
}
