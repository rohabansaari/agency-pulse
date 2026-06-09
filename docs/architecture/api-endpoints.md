# API Endpoint List

Base URL: `https://api.agencypulse.app/api/v1`  
Auth: `Authorization: Bearer {sanctum_token}`  
Tenant: `X-Organization-Id: {org_id}` header (or subdomain resolution)

All tenant routes require `auth:sanctum` + `tenant` middleware.

---

## Auth

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register org + admin user |
| POST | `/auth/login` | Public | Login, returns token |
| POST | `/auth/logout` | Auth | Revoke token |
| GET | `/auth/me` | Auth | Current user + memberships |
| POST | `/auth/forgot-password` | Public | Send reset link |
| POST | `/auth/reset-password` | Public | Reset password |
| POST | `/auth/switch-organization` | Auth | Switch active org context |

---

## Platform — Super Admin

Prefix: `/platform` · Middleware: `super_admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/platform/organizations` | List all orgs |
| GET | `/platform/organizations/{id}` | Org detail |
| PATCH | `/platform/organizations/{id}/status` | Suspend/activate |
| GET | `/platform/subscriptions` | All subscriptions |
| PATCH | `/platform/subscriptions/{id}` | Override plan |
| GET | `/platform/analytics` | MRR, org count, active users |
| GET | `/platform/plans` | CRUD subscription plans |

---

## Organization Settings

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/organization` | org.view | Org profile |
| PATCH | `/organization` | org.update | Update settings |
| GET | `/organization/settings` | org.view | Screenshot interval, work hours |
| PATCH | `/organization/settings` | org.update | Update settings |

---

## Employees & Departments

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/departments` | departments.view |
| POST | `/departments` | departments.create |
| PATCH | `/departments/{id}` | departments.update |
| DELETE | `/departments/{id}` | departments.delete |
| GET | `/employees` | employees.view |
| POST | `/employees` | employees.create |
| GET | `/employees/{id}` | employees.view |
| PATCH | `/employees/{id}` | employees.update |
| DELETE | `/employees/{id}` | employees.delete |
| POST | `/employees/{id}/invite` | employees.invite |
| PATCH | `/employees/{id}/status` | employees.update |

---

## Clients & Projects

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET/POST | `/clients` | clients.view / clients.create |
| GET/PATCH/DELETE | `/clients/{id}` | clients.view / update / delete |
| GET/POST | `/projects` | projects.view / projects.create |
| GET/PATCH/DELETE | `/projects/{id}` | projects.view / update / delete |
| GET/POST/DELETE | `/projects/{id}/members` | projects.manage_members |
| GET | `/projects/{id}/hours` | projects.view_hours |

---

## Time Tracking

### Automatic Timer

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/timer/start` | timer.start | Start timer (project_id optional) |
| POST | `/timer/stop` | timer.stop | Stop → `type=automatic`, `status=approved` |
| POST | `/timer/pause` | timer.pause | Pause active timer |
| POST | `/timer/resume` | timer.resume | Resume paused timer |
| GET | `/timer/active` | timer.view | Current active timer state |

### Manual Time Entries ⭐

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/time-entries/manual` | timesheets.create_manual | Submit → `status=pending` |
| PATCH | `/time-entries/{id}/manual` | timesheets.create_manual | Edit own pending/rejected entry |
| POST | `/time-entries/{id}/resubmit` | timesheets.create_manual | Rejected → pending after edit |
| GET | `/time-entries/pending-approval` | timesheets.approve | Manager/admin approval inbox |
| PATCH | `/time-entries/{id}/approve` | timesheets.approve | Approve + optional comment |
| PATCH | `/time-entries/{id}/reject` | timesheets.approve | Reject + **required** approval_comment |

**Manual submit body:** `project_id`, `task_name?`, `start_time`, `end_time`, `manual_reason` (required), `notes?`

### Timesheets & Queries

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/time-entries` | timesheets.view | List with filters |
| GET | `/time-entries/daily` | timesheets.view | Daily timesheet (shows status badges) |
| GET | `/time-entries/weekly` | timesheets.view | Weekly timesheet |
| GET | `/time-entries/summary` | timesheets.view | Approved vs pending hours split |

Query params: `employee_id`, `project_id`, `from`, `to`, `status`, `type` (`automatic`|`manual`), `page`

---

## Screenshots

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/screenshots/upload` | screenshots.upload | Desktop agent upload |
| GET | `/screenshots` | screenshots.view | Gallery with filters |
| GET | `/screenshots/{id}` | screenshots.view | Single + signed URL |
| PATCH | `/screenshots/{id}/flag` | screenshots.review | Flag for review |
| PATCH | `/screenshots/{id}/review` | screenshots.review | Mark reviewed |

Filters: `employee_id`, `from`, `to`, `project_id`, `flagged`

---

## Attendance

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/attendance` | attendance.view | List records |
| GET | `/attendance/summary` | attendance.view | Monthly summary |
| POST | `/attendance/generate` | attendance.generate | Trigger daily job |
| PATCH | `/attendance/{id}` | attendance.override | Manual override |

---

## Leave Management

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/leave-types` | leave.view | Org leave types |
| POST | `/leave-types` | leave.manage_types | Create type |
| GET | `/leave-balances` | leave.view | Balances (self or team) |
| GET | `/leave-requests` | leave.view | List requests |
| POST | `/leave-requests` | leave.apply | Apply leave |
| PATCH | `/leave-requests/{id}/approve` | leave.approve | Approve |
| PATCH | `/leave-requests/{id}/reject` | leave.approve | Reject |
| DELETE | `/leave-requests/{id}` | leave.cancel | Cancel own pending |

---

## Payroll

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/payrolls` | payroll.view | List periods |
| POST | `/payrolls/generate` | payroll.generate | Generate draft |
| GET | `/payrolls/{id}` | payroll.view | Period detail |
| PATCH | `/payrolls/{id}/approve` | payroll.approve | Approve period |
| PATCH | `/payrolls/{id}/mark-paid` | payroll.pay | Mark as paid |
| GET | `/payrolls/{id}/items` | payroll.view | Employee line items |
| POST | `/payrolls/{id}/items/{itemId}/adjustments` | payroll.adjust | Bonus/deduction |
| GET | `/payrolls/{id}/export/pdf` | payroll.export | Bulk PDF zip |
| GET | `/payrolls/{id}/export/csv` | payroll.export | CSV export |
| GET | `/payroll-history` | payroll.view_self | Employee own history |

---

## Reports

| Method | Endpoint | Permission | Export |
|--------|----------|------------|--------|
| GET | `/reports/employee-hours` | reports.view | csv,xlsx,pdf |
| GET | `/reports/payroll` | reports.view | csv,xlsx,pdf |
| GET | `/reports/project-hours` | reports.view | csv,xlsx,pdf |
| GET | `/reports/attendance` | reports.view | csv,xlsx,pdf |
| GET | `/reports/manual-vs-automatic` | reports.view | Hours split by type; csv,xlsx,pdf |
| POST | `/reports/export` | reports.export | Async job → download URL |

Query: `from`, `to`, `employee_id`, `project_id`, `client_id`, `format`

---

## Dashboard

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/dashboard/admin` | dashboard.admin |
| GET | `/dashboard/employee` | dashboard.employee |
| GET | `/dashboard/manager` | dashboard.manager |

---

## Response Envelope

```json
{
  "success": true,
  "data": {},
  "meta": { "current_page": 1, "total": 100 },
  "message": null
}
```

## Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 401 | `UNAUTHENTICATED` | Invalid/missing token |
| 403 | `FORBIDDEN` | Missing permission |
| 404 | `NOT_FOUND` | Resource not in tenant scope |
| 422 | `VALIDATION_ERROR` | Field errors |
| 429 | `RATE_LIMITED` | Too many requests |
