---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - PRD-agency-workforce-saas.md
  - system-architecture-final.md
  - domain-rules.md
project_name: HUBSTAFF CLONE (AgencyPulse)
version: "1.0"
date: "2026-06-08"
---

# AgencyPulse — Epic & User Story Breakdown

## Overview

Development-ready epics and stories derived from final architecture. Business logic is frozen per `domain-rules.md`. Stories are sized for single dev-agent completion.

---

# 1. EPICS LIST

| Epic | Title | Goal | Business Value | Dependencies |
|------|-------|------|----------------|--------------|
| **E1** | Multi-Tenant Foundation | Bootstrapped Laravel + Next.js with tenant isolation | SaaS-ready from day one | None |
| **E2** | Employee & RBAC | Org structure, roles, clients/projects | Enables all workforce features | E1 |
| **E3** | Timer System | Redis+DB hybrid timer with concurrency safety | Core trust engine for automatic hours | E1, E2 |
| **E4** | Manual Time Entry + Approval | Fraud-resistant manual logging workflow | Captures offline work without payroll risk | E2, E3 |
| **E5** | Screenshot System | Queue-based capture during active timers | Accountability without affecting pay | E3 |
| **E6** | Attendance Engine | Approved-only derived attendance | HR compliance automation | E3, E4 |
| **E7** | Payroll Engine | Locked payroll with retro adjustments | Revenue-critical accuracy | E3, E4, E6 |
| **E8** | Reporting & Dashboards | KPIs and exports | Owner visibility and decisions | E3–E7 |
| **E9** | Queue + Event System | Async infrastructure wired to domain events | Reliability at scale | E1 (parallel with E3+) |
| **E10** | Security + Audit | Cross-tenant safety, immutable payroll audit | Trust and compliance | E1 (cross-cutting) |

---

# 2. USER STORIES BY EPIC

---

## Epic 1: Multi-Tenant Foundation

### Story 1.1: Project Scaffold & Docker

As a **developer**, I want Laravel 12 + Next.js monorepo with Docker Compose, so that the team has a consistent local and deployable environment.

**Acceptance Criteria:**
- Given `docker-compose up`, MySQL, Redis, nginx, queue worker, and scheduler start
- When API health check is called, Then 200 OK
- When Next.js dev server runs, Then login page loads

**Edge cases:** Windows path spaces; env files documented in `.env.example`

**API:** `GET /api/health`

**DB:** `cache`, `jobs` tables (Laravel default)

---

### Story 1.2: Organization Registration & Sanctum Auth

As an **org admin**, I want to register my agency and log in, so that I can access the platform.

**Acceptance Criteria:**
- Given valid registration, When submitted, Then `organizations` + `users` + `organization_members(role=org_admin)` created
- When login succeeds, Then Sanctum token returned
- When `GET /auth/me`, Then user + memberships returned

**Edge cases:** Duplicate email → 422; duplicate org slug → 422

**API:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`

**DB:** `organizations`, `users`, `organization_members`

---

### Story 1.3: Tenant Resolution Middleware

As the **system**, I want every API request scoped to one organization, so that tenant data never leaks.

**Acceptance Criteria:**
- Given `X-Organization-Id` header, When user is member, Then `TenantContext` set
- When user is not member, Then 403 `TENANT_MISMATCH`
- When header missing, Then fallback to user's last org from cache

**Edge cases:** E-27 org suspended → 403 on tenant routes

**API:** All `/api/v1/*` tenant routes

**DB:** `organizations.status`

---

### Story 1.4: BelongsToOrganization Global Scope

As the **system**, I want all tenant models auto-scoped by `organization_id`, so that queries cannot cross tenants.

**Acceptance Criteria:**
- Given tenant context org_id=5, When querying `Employee`, Then only org 5 rows returned
- When creating model, Then `organization_id` auto-set
- Super-admin platform routes use `withoutGlobalScopes()` explicitly

**Edge cases:** Cross-tenant ID in URL → 404 not 403 (no leak)

**API:** N/A (infrastructure)

**DB:** Trait on all tenant models

---

### Story 1.5: Idempotency Middleware Foundation

As the **system**, I want idempotent POST handling, so that double-clicks never duplicate writes.

**Acceptance Criteria:**
- Given `Idempotency-Key` header, When same key replayed within 24h, Then identical response returned
- When key new, Then request processed and stored in `idempotency_records`
- Scheduled job purges expired records

**Edge cases:** E-25 duplicate manual POST

**API:** Middleware on manual entry + payroll generate routes

**DB:** `idempotency_records`

---

## Epic 2: Employee & RBAC System

### Story 2.1: Spatie RBAC with Teams

As an **org admin**, I want roles (org_admin, manager, employee) with permissions, so that access is controlled.

**Acceptance Criteria:**
- Given seeder runs, When roles assigned per `organization_members.role`, Then Spatie team_id = organization_id
- When employee hits admin route, Then 403
- Permission matrix matches `rbac-permissions.md`

**API:** Middleware `permission:*`

**DB:** Spatie tables + `RolePermissionSeeder`

---

### Story 2.2: Department CRUD

As an **org admin**, I want to manage departments, so that employees are organized.

**Acceptance Criteria:**
- CRUD endpoints work with pagination
- Soft delete preserves history
- Only org_admin can create/delete

**API:** `GET/POST/PATCH/DELETE /departments`

**DB:** `departments`

---

### Story 2.3: Employee CRUD & Invite

As an **org admin**, I want to add employees with salary type and hourly rate, so that payroll can be calculated.

**Acceptance Criteria:**
- Create employee with `salary_type` hourly|fixed, rates, department, manager_id
- Invite sends email job with activation link
- Inactive employee cannot start timer (E-26 prep)

**API:** `GET/POST/PATCH/DELETE /employees`, `POST /employees/{id}/invite`

**DB:** `employees`, links `organization_members`

---

### Story 2.4: Client & Project Management

As an **org admin**, I want clients and projects with member assignment, so that time is tracked against billable work.

**Acceptance Criteria:**
- CRUD clients and projects
- Assign employees via `project_members`
- Manual entry requires project membership (domain M-1)

**API:** `/clients`, `/projects`, `/projects/{id}/members`

**DB:** `clients`, `projects`, `project_members`

---

### Story 2.5: Manager Team Scope Policy

As a **manager**, I want to see only my direct reports, so that team data is properly scoped.

**Acceptance Criteria:**
- Policy checks `employees.manager_id` for manager role
- Org admin sees all
- Employee sees self only

**Edge cases:** E-10 manager cannot approve own entries (prep for E4)

**API:** Applied via policies on employee/timesheet routes

**DB:** `employees.manager_id`

---

## Epic 3: Timer System (Core Trust Engine)

### Story 3.1: Timer START with Redis Lock

As an **employee**, I want to start a timer on a project, so that my work is tracked automatically.

**Acceptance Criteria:**
- Given no active timer, When `POST /timer/start`, Then `time_entries` row `type=automatic, status=running` + Redis key set
- When active timer exists, Then 409 `TIMER_ALREADY_RUNNING` with existing entry (E-3)
- Lock acquired via Redis `SET NX` before DB write

**Edge cases:** E-1 browser close — timer persists; E-2 multi-device 409 on second START

**API:** `POST /timer/start`, `GET /timer/active`

**DB:** `time_entries`, Redis `org:{id}:timer:{emp_id}`

---

### Story 3.2: Timer STOP / PAUSE / RESUME

As an **employee**, I want to pause and stop my timer, so that breaks are excluded and sessions finalize correctly.

**Acceptance Criteria:**
- STOP sets `status=approved`, computes `duration_seconds`, deletes Redis (E-4 idempotent if <5s)
- PAUSE only from `running`; RESUME only from `paused`
- `time_entry_pauses` records pause intervals

**Edge cases:** E-13 midnight span — duration computed at STOP (attendance splits later)

**API:** `POST /timer/stop|pause|resume`

**DB:** `time_entries`, `time_entry_pauses`

---

### Story 3.3: Active Timer DB Constraint

As the **system**, I want at most one active automatic timer per employee, so that G-1 is enforced at DB level.

**Acceptance Criteria:**
- Generated column `is_active_timer` + UNIQUE index on `(employee_id, is_active_timer)`
- Second concurrent insert fails even if app bug

**Edge cases:** E-3 race — app lock + DB constraint double guard

**DB:** `time_entries` migration with functional index

---

### Story 3.4: Timer Heartbeat & Recovery Job

As the **system**, I want orphaned timers recovered and runaway timers stopped, so that crashes don't leave invalid state.

**Acceptance Criteria:**
- `POST /timer/heartbeat` updates Redis `last_heartbeat` every 60s
- `RecoverOrphanedTimers` every 5 min: rebuild Redis from DB; FORCE_STOP if >12h (E-6) or idle 4h (E-5)
- FORCE_STOP sets `force_stop_reason`, `status=approved`

**Edge cases:** E-5 server crash; E-26 employee terminated → FORCE_STOP

**API:** `POST /timer/heartbeat`

**DB:** `time_entries.force_stop_reason`; event `TimerStopped`

---

### Story 3.5: Timer Concurrency Integration Tests

As a **developer**, I want automated tests for timer races, so that payroll trust is verified.

**Acceptance Criteria:**
- Parallel START requests → exactly one `running` row
- Parallel STOP → one approved row, idempotent second response
- Tests cover E-1, E-2, E-3, E-4, E-6

**API:** Test suite `TimerConcurrencyTest`

**DB:** `time_entries`

---

### Story 3.6: Timer UI Widget (Next.js)

As an **employee**, I want a persistent timer widget, so that I can control tracking from the dashboard.

**Acceptance Criteria:**
- Shows active timer from `GET /timer/active` on load (E-1 reconnect)
- Start/Stop/Pause/Resume call API; displays elapsed time
- 409 shows existing timer instead of error toast

**API:** Timer endpoints

**DB:** N/A (frontend)

---

## Epic 4: Manual Time Entry + Approval Workflow

### Story 4.1: Submit Manual Time Entry

As an **employee**, I want to log manual work with a reason, so that offline work is captured for approval.

**Acceptance Criteria:**
- `POST /time-entries/manual` creates `type=manual, status=pending`
- Requires project_id, start/end, manual_reason ≥10 chars
- Single calendar day (org TZ); no future dates; max 12h entry
- Idempotency-Key required (E-25)

**Edge cases:** E-9 daily limit; E-18 no screenshots triggered

**API:** `POST /time-entries/manual`

**DB:** `time_entries`

---

### Story 4.2: Overlap Validation

As the **system**, I want to reject overlapping entries, so that hours cannot be double-counted.

**Acceptance Criteria:**
- Transaction + `lockForUpdate` on overlapping rows
- Rejects overlap with approved, pending, running, paused (E-7, E-8)
- Allows overlap with rejected only

**API:** 422 `OVERLAPS_ACTIVE_TIMER` | `OVERLAPS_EXISTING_ENTRY`

**DB:** `time_entries` overlap index

---

### Story 4.3: Edit, Cancel, Resubmit Manual Entry

As an **employee**, I want to fix pending or rejected entries, so that I can correct mistakes before approval.

**Acceptance Criteria:**
- PATCH pending/rejected only; approved blocked
- DELETE (soft) pending cancels entry
- Resubmit rejected → `status=pending` (E-15)

**API:** `PATCH /time-entries/{id}/manual`, `DELETE /time-entries/{id}`, `POST /time-entries/{id}/resubmit`

**DB:** `time_entries.deleted_at`

---

### Story 4.4: Approval Inbox & Approve

As a **manager**, I want to approve team manual entries, so that verified hours count toward payroll.

**Acceptance Criteria:**
- `GET /time-entries/pending-approval` scoped to team (manager) or all (admin)
- Approve sets `status=approved`, `approved_by`, `approved_at`
- Optimistic lock on `updated_at` (E-11 → 409 `ALREADY_REVIEWED`)
- Manager cannot approve own (E-10 → 403)
- Entries >4h require org_admin (escalation flag)

**Edge cases:** E-12 retro queue triggered if payroll locked (handled E7)

**API:** `GET /time-entries/pending-approval`, `PATCH /time-entries/{id}/approve`

**DB:** `time_entries`; dispatches `ManualEntryApproved`

---

### Story 4.5: Reject Manual Entry

As a **manager**, I want to reject entries with a comment, so that employees understand what to fix.

**Acceptance Criteria:**
- Reject requires `approval_comment` ≥5 chars
- Sets `status=rejected`
- Notifies employee via queued job

**API:** `PATCH /time-entries/{id}/reject`

**DB:** `time_entries.approval_comment`

---

### Story 4.6: Void Approved Manual Entry (Admin)

As an **org admin**, I want to void an approved manual entry, so that fraudulent approvals are reversed.

**Acceptance Criteria:**
- Admin only; sets `status=rejected` with required comment
- Triggers attendance recalc job
- If payroll locked, creates `payroll_retro_queue` entry (E-24)

**API:** `PATCH /time-entries/{id}/void`

**DB:** `time_entries`, `payroll_retro_queue`

---

## Epic 5: Screenshot System

### Story 5.1: Screenshot Upload Accept + Queue

As the **desktop agent**, I want to upload screenshots during active timers, so that work is visually verified.

**Acceptance Criteria:**
- Only when linked `time_entry` is `running` (not paused) — E-17
- `type=manual` never accepts upload — E-18
- Returns 202; dispatches `ScreenshotUploadJob`
- Dedup via `(time_entry_id, capture_slot)` unique — E-16

**API:** `POST /screenshots/upload` + Idempotency-Key + `X-Capture-Slot`

**DB:** `screenshots` (pending → completed)

---

### Story 5.2: Screenshot Processing Job

As the **system**, I want images resized and stored on S3, so that gallery loads efficiently.

**Acceptance Criteria:**
- WebP conversion + thumbnail
- S3 path `org/{id}/screenshots/...`
- Failed uploads retry 3× then `screenshots_retry` queue

**Edge cases:** E-16 three misses → `time_entries.screenshot_gap=true`

**DB:** `screenshots.image_path`, `thumbnail_path`

---

### Story 5.3: Screenshot Gallery API

As a **manager**, I want to browse screenshots by employee and date, so that I can review activity.

**Acceptance Criteria:**
- Filter by employee_id, date range, project
- Returns signed URLs (15 min TTL)
- RBAC: manager team scope

**API:** `GET /screenshots`, `GET /screenshots/{id}`

**DB:** `screenshots`

---

### Story 5.4: Screenshot Retention Job

As the **system**, I want old screenshots purged per plan, so that storage costs are controlled.

**Acceptance Criteria:**
- Weekly job deletes S3 + DB rows past plan retention
- Orphan screenshots deleted after 7 days

**DB:** `screenshots`; `subscription_plans.features`

---

## Epic 6: Attendance Engine

### Story 6.1: Daily Attendance Generation Job

As the **system**, I want attendance auto-generated from approved hours, so that HR records are accurate.

**Acceptance Criteria:**
- Runs 00:30 org-local for previous day
- Sums only `status=approved` seconds (E-14)
- Derives present/late/half_day/absent per domain rules §4.3
- Sets `is_locked=true` after generation

**Edge cases:** E-19 leave day + work; E-20 holiday + work

**DB:** `attendance_records`

---

### Story 6.2: Attendance Recalculation on Approval

As the **system**, I want attendance updated when late approvals occur, so that records stay correct.

**Acceptance Criteria:**
- `ManualEntryApproved` / `TimerStopped` dispatches `RecalculateAttendanceForDateJob`
- Skips if `is_auto_generated=false` (admin override)
- E-28 late approval recalcs day D

**API:** N/A (event-driven)

**DB:** `attendance_records`

---

### Story 6.3: Organization Holidays

As an **org admin**, I want to define holidays, so that attendance expectations adjust.

**Acceptance Criteria:**
- CRUD `organization_holidays`
- Holiday dates → `status=holiday`, `expected_hours=0`

**API:** `GET/POST/DELETE /organization/holidays`

**DB:** `organization_holidays`

---

### Story 6.4: Attendance Admin Override

As an **org admin**, I want to manually override attendance, so that exceptions are handled.

**Acceptance Criteria:**
- PATCH sets status + notes; `is_auto_generated=false`
- Reset endpoint restores auto calculation

**API:** `PATCH /attendance/{id}`, `POST /attendance/{id}/reset-auto`

**DB:** `attendance_records`

---

## Epic 7: Payroll Engine

### Story 7.1: Payroll Period & Draft Generation

As an **org admin**, I want to generate draft payroll for a period, so that salaries can be reviewed.

**Acceptance Criteria:**
- `POST /payrolls/generate` with Idempotency-Key
- Org Redis lock during generation
- Hourly: `FLOOR(SUM approved_seconds)/60` × rate (E-30: 59s = 0 min)
- Fixed: prorated monthly salary
- Only `status=approved` entries by `start_time` in period (E-14)

**API:** `POST /payrolls/generate`

**DB:** `payrolls`, `payroll_items`

---

### Story 7.2: Payroll Bonuses & Deductions

As an **org admin**, I want to add bonuses and deductions to payroll lines, so that adjustments are applied.

**Acceptance Criteria:**
- CRUD adjustments on draft payroll only
- Recalculates `net_pay` per item and payroll totals

**API:** `POST /payrolls/{id}/items/{itemId}/adjustments`

**DB:** `payroll_item_adjustments`

---

### Story 7.3: Payroll Approve & Lock

As an **org admin**, I want to approve payroll to lock it, so that amounts cannot be tampered with.

**Acceptance Criteria:**
- Approve sets `status=approved`, `locked_at`
- Regenerate blocked → 409 `PAYROLL_LOCKED` (E-23)
- `payroll_items.approved_seconds` snapshot immutable

**API:** `PATCH /payrolls/{id}/approve`

**DB:** `payrolls.locked_at`

---

### Story 7.4: Retro Payroll Adjustment Queue

As the **system**, I want late-approved hours after payroll lock added to next draft, so that no silent pay changes occur.

**Acceptance Criteria:**
- `DetectRetroPayrollAdjustmentJob` on `ManualEntryApproved`
- If work period has locked payroll, insert `payroll_retro_queue`
- Next draft payroll includes `retro_hours` adjustment (E-12)

**DB:** `payroll_retro_queue`, `payroll_item_adjustments.type=retro_hours`

---

### Story 7.5: Payroll PDF Export

As an **org admin**, I want PDF export of approved payroll, so that records can be shared.

**Acceptance Criteria:**
- Async `GeneratePayrollPdfJob`
- PDF stored S3; download via signed URL
- Only `approved` or `paid` payrolls

**API:** `GET /payrolls/{id}/export/pdf`

**DB:** `payroll_items.pdf_path`

---

### Story 7.6: Mark Payroll Paid

As an **org admin**, I want to mark payroll as paid, so that the lifecycle is complete.

**Acceptance Criteria:**
- `paid` status immutable
- Corrections require new correction payroll record

**API:** `PATCH /payrolls/{id}/mark-paid`

**DB:** `payrolls.paid_at`

---

## Epic 8: Reporting & Dashboards

### Story 8.1: Admin Dashboard KPIs

As an **org admin**, I want key metrics on my dashboard, so that I see agency health at a glance.

**Acceptance Criteria:**
- Hours today (approved only)
- Pending manual count
- Payroll MTD
- Active employees / projects
- Cached 60s Redis

**API:** `GET /dashboard/admin`

**DB:** `time_entries`, `payrolls`, `daily_employee_hours`

---

### Story 8.2: Employee Dashboard

As an **employee**, I want my hours and pending manual status, so that I know where I stand.

**Acceptance Criteria:**
- Today's approved hours
- Weekly hours
- Pending manual entries list with status
- Recent payroll history

**API:** `GET /dashboard/employee`

**DB:** `time_entries`, `payrolls`

---

### Story 8.3: Employee Hours Report

As an **org admin**, I want employee hours report with export, so that I can analyze utilization.

**Acceptance Criteria:**
- Filter by date range, employee
- CSV/Excel/PDF async export
- Approved hours only

**API:** `GET /reports/employee-hours`, `POST /reports/export`

---

### Story 8.4: Manual vs Automatic Report

As an **org admin**, I want to compare manual vs automatic hours, so that I can monitor manual entry abuse.

**Acceptance Criteria:**
- Stacked breakdown by employee
- Uses `daily_employee_hours` summary table

**API:** `GET /reports/manual-vs-automatic`

**DB:** `daily_employee_hours`

---

### Story 8.5: Manager Dashboard

As a **manager**, I want team-scoped dashboard, so that I see my direct reports only.

**Acceptance Criteria:**
- Team hours, pending approvals count
- Scoped via `manager_id`

**API:** `GET /dashboard/manager`

---

## Epic 9: Queue + Event System

### Story 9.1: Queue Configuration & Horizon

As a **developer**, I want named queues configured, so that workloads are isolated.

**Acceptance Criteria:**
- Queues: `critical`, `screenshots`, `payroll`, `attendance`, `default`
- Supervisor config in Docker
- Failed job monitoring

**DB:** `jobs`, `failed_jobs`

---

### Story 9.2: Domain Events & Listeners

As the **system**, I want domain events wired to jobs, so that side effects are async and reliable.

**Acceptance Criteria:**
- Events: TimerStarted, TimerStopped, ManualEntrySubmitted, ManualEntryApproved, PayrollGenerated, ScreenshotCaptured
- Listeners dispatch correct jobs per architecture §7
- Events use `afterCommit()`

**DB:** N/A

---

### Story 9.3: TenantAwareJob Base Class

As the **developer**, I want all queued jobs tenant-scoped, so that background work respects isolation.

**Acceptance Criteria:**
- Job payload includes `organization_id`
- `handle()` restores `TenantContext` before execute

**DB:** N/A

---

### Story 9.4: Laravel Scheduler Setup

As the **system**, I want scheduled commands running, so that attendance and recovery are automated.

**Acceptance Criteria:**
- `RecoverOrphanedTimers` — every 5 min
- `GenerateAttendanceForAllOrgs` — daily staggered
- `PurgeScreenshotRetention` — weekly
- `PurgeIdempotencyRecords` — daily

---

## Epic 10: Security + Audit System

### Story 10.1: Audit Logger Service

As the **system**, I want all sensitive mutations logged, so that disputes are traceable.

**Acceptance Criteria:**
- Logs time_entry status changes, payroll transitions, voids
- Stores old/new JSON, user_id, ip, request_id

**DB:** `audit_logs`

---

### Story 10.2: Cross-Tenant Access Test Suite

As a **developer**, I want tests proving tenant isolation, so that data leaks are impossible.

**Acceptance Criteria:**
- Every resource type: org A user cannot read/write org B IDs
- Returns 404 or 403 consistently

---

### Story 10.3: Payroll Immutability Guards

As the **system**, I want locked payroll rows protected, so that pay cannot be manipulated.

**Acceptance Criteria:**
- Model observer blocks UPDATE on `payroll_items` when payroll `approved|paid`
- Adjustments only via `payroll_item_adjustments` on draft or retro queue

**Edge cases:** E-22 draft regenerate OK; E-23 approved blocked

**DB:** `payrolls`, `payroll_items`

---

### Story 10.4: Rate Limiting & Security Headers

As the **system**, I want API rate limits, so that abuse is prevented.

**Acceptance Criteria:**
- Auth: 60/min; API: 300/min; screenshot upload: 10/min
- CORS restricted to frontend domain

**API:** Middleware `throttle:*`

---

# 3. SPRINT BREAKDOWN

## Sprint 0 — Foundation (2 weeks)

| Stories | Epic |
|---------|------|
| 1.1 Project Scaffold & Docker | E1 |
| 1.2 Organization Registration & Sanctum Auth | E1 |
| 1.3 Tenant Resolution Middleware | E1 |
| 1.4 BelongsToOrganization Global Scope | E1 |
| 1.5 Idempotency Middleware Foundation | E1 |
| 9.1 Queue Configuration | E9 |
| 9.4 Scheduler Setup (skeleton) | E9 |

**Exit:** Register org, login, tenant-scoped empty API.

---

## Sprint 1 — Core Tracking (2 weeks)

| Stories | Epic |
|---------|------|
| 2.1–2.4 RBAC, Employees, Clients/Projects | E2 |
| 3.1–3.5 Timer backend + concurrency tests | E3 |
| 3.6 Timer UI widget | E3 |
| 4.1–4.3 Manual submit, overlap, edit | E4 |
| 9.2 Domain Events (Timer events only) | E9 |
| 10.1 Audit Logger (timer mutations) | E10 |

**Exit:** Employee runs timer; submits manual entry; overlap rejected.

---

## Sprint 2 — Control Layer (2 weeks)

| Stories | Epic |
|---------|------|
| 2.5 Manager team scope | E2 |
| 4.4–4.6 Approval, reject, void | E4 |
| 5.1–5.4 Screenshot pipeline + gallery | E5 |
| 9.2 Domain Events (Manual + Screenshot) | E9 |
| 9.3 TenantAwareJob | E9 |
| 10.2 Cross-tenant tests | E10 |

**Exit:** Manager approves manual entries; screenshots during timer.

---

## Sprint 3 — Business Logic (2 weeks)

| Stories | Epic |
|---------|------|
| 6.1–6.4 Attendance engine | E6 |
| 7.1–7.6 Payroll engine + retro + PDF | E7 |
| 9.2 Events (Payroll + Attendance jobs) | E9 |
| 10.3 Payroll immutability guards | E10 |

**Exit:** End-to-end: timer → attendance → payroll draft → approve → PDF.

---

## Sprint 4 — Product Layer (2 weeks)

| Stories | Epic |
|---------|------|
| 8.1–8.5 Dashboards + reports | E8 |
| 10.4 Rate limiting | E10 |
| Leave module (from PRD — stories TBD phase 1.5) | — |
| E2E happy path tests | — |

**Exit:** MVP demo-ready for agency pilot.

---

# 4. DEPENDENCY GRAPH

```
                    ┌─────────────┐
                    │  E1 Foundation │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐   ┌────────┐   ┌────────┐
         │ E9 Queue│   │E10 Audit│   │  E2 RBAC │
         └────┬───┘   └────┬───┘   └────┬─────┘
              │            │            │
              └────────────┼────────────┘
                           ▼
                    ┌─────────────┐
                    │ E3 Timer ★  │  ← CRITICAL PATH
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            │
         ┌─────────┐  ┌─────────┐       │
         │ E4 Manual│  │E5 Screen│      │
         └────┬────┘  └─────────┘       │
              │                          │
              ▼                          │
         ┌─────────┐                     │
         │ E6 Attend│◄──────────────────┘
         └────┬────┘
              ▼
         ┌─────────┐
         │ E7 Payroll ★ │  ← CRITICAL PATH
         └────┬────┘
              ▼
         ┌─────────┐
         │ E8 Reports │
         └─────────┘
```

### Critical Path to MVP

`E1 → E2 → E3 → E4 → E6 → E7 → E8`

**Blockers:**
- E4 approvals blocked by E2 (manager scope) + E3 (overlap with timer)
- E5 blocked by E3 (active timer)
- E6 blocked by E3 + E4 (approved hours source)
- E7 blocked by E6 (optional soft) + E4 (approved manual)
- E8 blocked by all upstream data

---

# 5. RISK ANALYSIS

| Module | Risk Level | Complexity | Notes |
|--------|:----------:|:----------:|-------|
| **E3 Timer** | 🔴 HIGH | Redis+DB hybrid, races | Must ship concurrency tests before MVP; no shortcuts |
| **E7 Payroll** | 🔴 HIGH | Money + locking + retro | One bug = legal dispute; feature-freeze after Sprint 3 |
| **E4 Manual overlap** | 🟠 MEDIUM-HIGH | Transaction locking | Edge cases E-7–E-12 need explicit tests |
| **E5 Screenshots** | 🟠 MEDIUM | S3 + queue at scale | Not payroll-critical; can degrade gracefully |
| **E6 Attendance** | 🟡 MEDIUM | TZ + DST + splits | E-13, E-21 need timezone test suite |
| **E9 Events** | 🟡 MEDIUM | Ordering, afterCommit | Miswired listener = stale attendance |
| **E1 Tenancy** | 🔴 HIGH | Silent leak = catastrophic | E10.2 must run in CI on every PR |

### Complexity Hotspots

1. `time_entries` unified table — timer + manual share schema
2. `PayrollCalculatorService` — hourly floor rounding + retro queue
3. `TimeEntryOverlapValidator` — half-open intervals + active timer
4. Optimistic approval lock — `updated_at` coordination

### Potential Refactor Zones (post-MVP)

- Extract timer to dedicated microservice if >5k concurrent timers
- `daily_employee_hours` → materialized view or CDC pipeline
- Desktop agent protocol (separate epic)

### Mitigation Plan

| Risk | Mitigation |
|------|------------|
| Timer races | Story 3.5 mandatory before Sprint 1 close |
| Payroll errors | Golden-file tests with known hour sets |
| Tenant leak | Story 10.2 in CI gate |
| Event failures | Dead letter queue + alert on `failed_jobs` |

---

## Story Count Summary

| Epic | Stories |
|------|---------|
| E1 | 5 |
| E2 | 5 |
| E3 | 6 |
| E4 | 6 |
| E5 | 4 |
| E6 | 4 |
| E7 | 6 |
| E8 | 5 |
| E9 | 4 |
| E10 | 4 |
| **Total** | **49** |

---

**Next step:** Run `bmad-dev-story` on Story 1.1 to begin Sprint 0 implementation.
