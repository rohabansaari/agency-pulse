# AgencyPulse — Final System Architecture (Implementation-Ready)

**Version:** 1.0 · **Date:** 2026-06-08  
**Authority:** Translates [domain-rules.md](../../docs/architecture/domain-rules.md) — business logic is frozen.  
**Audience:** Backend, frontend, DevOps engineers and AI implementation agents.

---

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                             │
│  Next.js SPA (timer, manual entries, approvals)  │  Desktop Agent (screenshots) │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ HTTPS  Authorization: Bearer (Sanctum)
                                │        X-Organization-Id: {org_id}
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EDGE — Nginx / ALB                                       │
│  Rate limit │ TLS │ CORS │ Request ID injection                                 │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    LARAVEL 12 API (stateless workers)                            │
│ ┌─────────────┐ ┌──────────────────────────────────────────────────────────┐   │
│ │ Middleware  │ │ auth:sanctum → ResolveTenant → RBAC → Idempotency        │   │
│ └─────────────┘ └──────────────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────────────────────┐    │
│ │                        HTTP Controllers (thin)                           │    │
│ │  Timer │ ManualEntry │ Approval │ Screenshot │ Attendance │ Payroll     │    │
│ └─────────────────────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────────────────────┐    │
│ │                         DOMAIN SERVICES (sync)                           │    │
│ │  TimerService          │ Redis lock + DB txn │ SYNC hot path            │    │
│ │  ManualTimeEntryService│ DB txn FOR UPDATE   │ SYNC                     │    │
│ │  ApprovalService       │ Optimistic lock     │ SYNC                     │    │
│ │  ScreenshotService     │ Validate + dispatch │ SYNC accept / ASYNC proc  │    │
│ │  AttendanceService     │ Read/compute        │ SYNC read / ASYNC write   │    │
│ │  PayrollCalculatorSvc  │ Snapshot + lock     │ SYNC trigger / ASYNC gen  │    │
│ └─────────────────────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────────────────────┐    │
│ │  Repositories (Eloquent) │ Policies │ Form Requests │ API Resources      │    │
│ └─────────────────────────────────────────────────────────────────────────┘    │
└───────────┬──────────────────────────────┬──────────────────────┬───────────────┘
            │                              │                      │
            ▼                              ▼                      ▼
   ┌────────────────┐            ┌─────────────────┐    ┌───────────────┐
   │ MySQL 8 (RDS)  │            │ Redis (ElastiCache)│    │ S3 + CloudFront│
   │ Source of truth│            │ Timer state       │    │ Screenshots    │
   │ time_entries   │            │ Distributed locks │    │ Exports/PDFs   │
   │ payrolls       │            │ Idempotency cache │    │ Attachments    │
   └────────────────┘            │ Dashboard cache   │    └───────────────┘
                                 └─────────┬─────────┘
                                           ▼
                              ┌─────────────────────────┐
                              │ Laravel Queue Workers    │
                              │ critical │ screenshots  │
                              │ payroll  │ attendance   │
                              │ reports  │ notifications│
                              └─────────────────────────┘
```

### Service Boundaries

| Module | Service | Repository | Sync | Async |
|--------|---------|------------|:----:|:-----:|
| Timer | `TimerService` | `TimeEntryRepository` | START/STOP/PAUSE/RESUME/heartbeat | `RecoverOrphanedTimers` (schedule) |
| Manual Entry | `ManualTimeEntryService` | `TimeEntryRepository` | submit/edit/cancel | `NotifyManualEntrySubmitted` |
| Approval | `ApprovalService` | `TimeEntryRepository` | approve/reject | `RecalculateAttendanceForDate`, retro detection |
| Screenshot | `ScreenshotService` | `ScreenshotRepository` | upload accept (202) | `ScreenshotUploadJob`, `RetryFailedScreenshotsJob` |
| Attendance | `AttendanceService` | `AttendanceRepository` | read/summary | `GenerateAttendanceJob`, `RecalculateAttendanceForDateJob` |
| Payroll | `PayrollCalculatorService` | `PayrollRepository` | trigger generate | `GeneratePayrollJob`, `GeneratePayrollPdfJob` |

### Cross-System Data Flow

```
TIMER START ──sync──► time_entries(running) + Redis
         └──event──► TimerStarted ──► ScreenshotScheduleService (Redis next_capture)

TIMER STOP ──sync──► time_entries(approved) + delete Redis
        └──event──► TimerStopped ──► RecalculateAttendanceForDateJob (async)

MANUAL SUBMIT ──sync──► time_entries(pending) + overlap txn
           └──event──► ManualEntrySubmitted ──► NotifyManagerJob

MANUAL APPROVE ──sync──► time_entries(approved) + optimistic lock
            └──event──► ManualEntryApproved ──► RecalculateAttendanceForDateJob
                                            ──► DetectRetroPayrollAdjustmentJob

PAYROLL GENERATE ──sync──► payrolls(draft) + org lock
              └──job──► GeneratePayrollJob ──► payroll_items snapshot
                                              ──► PayrollGenerated event

SCREENSHOT UPLOAD ──sync──► validate + dedupe key
               └──job──► ScreenshotUploadJob ──► S3 + screenshots row
                                              ──► ScreenshotCaptured event
```

---

## 2. Database Design (Final)

### 2.1 `time_entries` (Unified — Critical)

```sql
CREATE TABLE time_entries (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid                CHAR(36) NOT NULL,
    organization_id     BIGINT UNSIGNED NOT NULL,
    employee_id         BIGINT UNSIGNED NOT NULL,
    project_id          BIGINT UNSIGNED NULL,
    task_name           VARCHAR(255) NULL,
    type                ENUM('automatic','manual') NOT NULL DEFAULT 'automatic',
    status              ENUM('running','paused','pending','approved','rejected') NOT NULL DEFAULT 'running',
    start_time          TIMESTAMP NOT NULL,
    end_time            TIMESTAMP NULL,
    duration_seconds    INT UNSIGNED NOT NULL DEFAULT 0,
    paused_seconds      INT UNSIGNED NOT NULL DEFAULT 0,
    activity_percentage TINYINT UNSIGNED NULL,
    notes               TEXT NULL,
    manual_reason       TEXT NULL,
    approval_comment    TEXT NULL,
    requires_admin_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by         BIGINT UNSIGNED NULL,
    approved_at         TIMESTAMP NULL,
    screenshot_gap      BOOLEAN NOT NULL DEFAULT FALSE,
    force_stop_reason   VARCHAR(50) NULL,
    idempotency_key     VARCHAR(64) NULL,
    deleted_at          TIMESTAMP NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,

    CONSTRAINT fk_te_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_te_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_te_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    CONSTRAINT fk_te_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_te_manual_reason CHECK (type != 'manual' OR manual_reason IS NOT NULL),
    CONSTRAINT chk_te_duration CHECK (duration_seconds >= 0),

    UNIQUE KEY uq_te_uuid (uuid),
    UNIQUE KEY uq_te_idempotency (organization_id, idempotency_key),

    INDEX idx_te_org_emp_start (organization_id, employee_id, start_time),
    INDEX idx_te_org_emp_status_start (organization_id, employee_id, status, start_time),
    INDEX idx_te_org_status_type (organization_id, status, type),
    INDEX idx_te_org_proj_start (organization_id, project_id, start_time),
    INDEX idx_te_payroll (organization_id, employee_id, status, start_time),
    INDEX idx_te_overlap (organization_id, employee_id, start_time, end_time, status),
    INDEX idx_te_pending_queue (organization_id, status, type, created_at)
);
```

**Active timer enforcement (app + DB):**

```sql
-- MySQL 8.0.13+ functional index workaround: generated column
ALTER TABLE time_entries ADD COLUMN is_active_timer TINYINT(1) AS (
    IF(type = 'automatic' AND status IN ('running','paused'), 1, NULL)
) STORED;

CREATE UNIQUE INDEX uq_te_one_active_timer ON time_entries (employee_id, is_active_timer);
```

### 2.2 `time_entry_pauses`

```sql
CREATE TABLE time_entry_pauses (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    time_entry_id   BIGINT UNSIGNED NOT NULL,
    paused_at       TIMESTAMP NOT NULL,
    resumed_at      TIMESTAMP NULL,
    duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE,
    INDEX idx_pause_entry (time_entry_id, paused_at)
);
```

### 2.3 `time_entry_attachments` (manual optional)

```sql
CREATE TABLE time_entry_attachments (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    time_entry_id   BIGINT UNSIGNED NOT NULL,
    organization_id BIGINT UNSIGNED NOT NULL,
    storage_path    VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    file_size_bytes INT UNSIGNED NOT NULL,
    created_at      TIMESTAMP NULL,
    FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE,
    INDEX idx_tea_entry (time_entry_id)
);
```

### 2.4 `screenshots`

```sql
CREATE TABLE screenshots (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id     BIGINT UNSIGNED NOT NULL,
    employee_id         BIGINT UNSIGNED NOT NULL,
    time_entry_id       BIGINT UNSIGNED NULL,
    capture_slot        BIGINT UNSIGNED NOT NULL,
    storage_disk        VARCHAR(50) NOT NULL DEFAULT 's3',
    image_path          VARCHAR(500) NOT NULL,
    thumbnail_path      VARCHAR(500) NULL,
    file_size_bytes     INT UNSIGNED NOT NULL,
    captured_at         TIMESTAMP NOT NULL,
    activity_percentage TINYINT UNSIGNED NULL,
    upload_status       ENUM('pending','completed','failed') DEFAULT 'completed',
    is_flagged          BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by         BIGINT UNSIGNED NULL,
    reviewed_at         TIMESTAMP NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE SET NULL,
    UNIQUE KEY uq_ss_dedupe (time_entry_id, capture_slot),
    INDEX idx_ss_gallery (organization_id, employee_id, captured_at DESC),
    INDEX idx_ss_org_date (organization_id, captured_at DESC)
);
```

### 2.5 `attendance_records`

```sql
CREATE TABLE attendance_records (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id     BIGINT UNSIGNED NOT NULL,
    employee_id         BIGINT UNSIGNED NOT NULL,
    date                DATE NOT NULL,
    status              ENUM('present','absent','late','half_day','leave','holiday') NOT NULL,
    worked_hours        DECIMAL(5,2) NOT NULL DEFAULT 0,
    worked_seconds      INT UNSIGNED NOT NULL DEFAULT 0,
    expected_hours      DECIMAL(5,2) NOT NULL DEFAULT 8,
    first_clock_in      TIMESTAMP NULL,
    last_clock_out      TIMESTAMP NULL,
    is_auto_generated   BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
    notes               TEXT NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    UNIQUE KEY uq_att_day (organization_id, employee_id, date),
    INDEX idx_att_org_date_status (organization_id, date, status)
);
```

### 2.6 `organization_holidays`

```sql
CREATE TABLE organization_holidays (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    date            DATE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP NULL,
    UNIQUE KEY uq_holiday (organization_id, date)
);
```

### 2.7 Payroll (Locking)

```sql
CREATE TABLE payrolls (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid                CHAR(36) NOT NULL,
    organization_id     BIGINT UNSIGNED NOT NULL,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    period_start_utc    TIMESTAMP NOT NULL,
    period_end_utc      TIMESTAMP NOT NULL,
    status              ENUM('draft','processing','approved','paid') NOT NULL DEFAULT 'draft',
    idempotency_key     VARCHAR(64) NULL,
    total_gross         DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_deductions    DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_net           DECIMAL(14,2) NOT NULL DEFAULT 0,
    generated_by        BIGINT UNSIGNED NOT NULL,
    approved_by         BIGINT UNSIGNED NULL,
    approved_at         TIMESTAMP NULL,
    paid_at             TIMESTAMP NULL,
    locked_at           TIMESTAMP NULL,
    notes               TEXT NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    UNIQUE KEY uq_payroll_period (organization_id, period_start, period_end),
    UNIQUE KEY uq_payroll_idem (organization_id, idempotency_key),
    INDEX idx_payroll_org_status (organization_id, status)
);

CREATE TABLE payroll_items (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payroll_id          BIGINT UNSIGNED NOT NULL,
    employee_id         BIGINT UNSIGNED NOT NULL,
    salary_type         ENUM('hourly','fixed') NOT NULL,
    approved_seconds    INT UNSIGNED NOT NULL DEFAULT 0,
    approved_hours      DECIMAL(8,2) NOT NULL DEFAULT 0,
    hourly_rate         DECIMAL(10,2) NULL,
    monthly_salary      DECIMAL(12,2) NULL,
    gross_pay           DECIMAL(12,2) NOT NULL,
    total_bonuses       DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_deductions    DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_pay             DECIMAL(12,2) NOT NULL,
    pdf_path            VARCHAR(500) NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    UNIQUE KEY uq_pi_employee (payroll_id, employee_id),
    FOREIGN KEY (payroll_id) REFERENCES payrolls(id) ON DELETE CASCADE
);

CREATE TABLE payroll_item_adjustments (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payroll_item_id BIGINT UNSIGNED NOT NULL,
    type            ENUM('bonus','deduction','retro_hours') NOT NULL,
    label           VARCHAR(255) NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    seconds         INT UNSIGNED NULL,
    source_entry_id BIGINT UNSIGNED NULL,
    notes           TEXT NULL,
    created_at      TIMESTAMP NULL,
    FOREIGN KEY (payroll_item_id) REFERENCES payroll_items(id) ON DELETE CASCADE,
    FOREIGN KEY (source_entry_id) REFERENCES time_entries(id) ON DELETE SET NULL
);

CREATE TABLE payroll_retro_queue (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id     BIGINT UNSIGNED NOT NULL,
    time_entry_id       BIGINT UNSIGNED NOT NULL,
    payroll_period_start DATE NOT NULL,
    payroll_period_end   DATE NOT NULL,
    seconds             INT UNSIGNED NOT NULL,
    status              ENUM('pending','applied','void') DEFAULT 'pending',
    applied_payroll_id  BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NULL,
    UNIQUE KEY uq_retro_entry (time_entry_id, payroll_period_start),
    INDEX idx_retro_pending (organization_id, status)
);
```

### 2.8 `audit_logs` + `idempotency_records`

```sql
CREATE TABLE audit_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NULL,
    user_id         BIGINT UNSIGNED NULL,
    auditable_type  VARCHAR(255) NOT NULL,
    auditable_id    BIGINT UNSIGNED NOT NULL,
    event           VARCHAR(50) NOT NULL,
    old_values      JSON NULL,
    new_values      JSON NULL,
    ip_address      VARCHAR(45) NULL,
    request_id      VARCHAR(36) NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_org_entity (organization_id, auditable_type, auditable_id),
    INDEX idx_audit_created (created_at)
);

CREATE TABLE idempotency_records (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    route           VARCHAR(100) NOT NULL,
    response_code   SMALLINT NOT NULL,
    response_body   JSON NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP NULL,
    UNIQUE KEY uq_idem (organization_id, idempotency_key, route),
    INDEX idx_idem_expires (expires_at)
);
```

### 2.9 Precomputed Aggregation (Scale)

```sql
CREATE TABLE daily_employee_hours (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    employee_id     BIGINT UNSIGNED NOT NULL,
    date            DATE NOT NULL,
    approved_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    automatic_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    manual_seconds  INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP NULL,
    UNIQUE KEY uq_deh (organization_id, employee_id, date),
    INDEX idx_deh_org_date (organization_id, date)
);
```

Refreshed by `SyncDailyEmployeeHoursJob` on: TimerStopped, ManualEntryApproved, VoidEntry.

### 2.10 Supporting Tables (unchanged from prior schema)

`organizations`, `users`, `organization_members`, `employees`, `departments`, `clients`, `projects`, `project_members`, `leave_types`, `leave_balances`, `leave_requests`, `subscription_plans`, `subscriptions`, `organization_settings`.

---

## 3. API Architecture

Base: `/api/v1` · Auth: `Bearer {token}` · Tenant: `X-Organization-Id`

### 3.1 Response Envelope

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "error": null
}
```

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TIMER_ALREADY_RUNNING",
    "message": "An active timer already exists.",
    "details": { "time_entry_id": 42 }
  }
}
```

### 3.2 Timer API

| Method | Path | Idempotency | Description |
|--------|------|:-----------:|-------------|
| POST | `/timer/start` | Optional | Body: `{ project_id? }` |
| POST | `/timer/stop` | Optional | Idempotent 200 if < 5s |
| POST | `/timer/pause` | — | |
| POST | `/timer/resume` | — | |
| GET | `/timer/active` | — | Returns active or null |
| POST | `/timer/heartbeat` | — | Body: `{ client_id? }` |

**Start response 201:**
```json
{
  "data": {
    "id": 42, "uuid": "...", "type": "automatic", "status": "running",
    "start_time": "2026-06-08T14:00:00Z", "project_id": 5,
    "screenshot_interval": 600, "next_capture_at": "2026-06-08T14:10:00Z"
  }
}
```

### 3.3 Manual Entry API

| Method | Path | Idempotency | Description |
|--------|------|:-----------:|-------------|
| POST | `/time-entries/manual` | **Required** | Submit pending entry |
| PATCH | `/time-entries/{id}/manual` | — | Edit pending/rejected |
| DELETE | `/time-entries/{id}` | — | Soft-delete pending |
| POST | `/time-entries/{id}/resubmit` | — | rejected → pending |

**Submit body:**
```json
{
  "project_id": 5,
  "task_name": "Client call",
  "start_time": "2026-06-08T09:00:00Z",
  "end_time": "2026-06-08T10:30:00Z",
  "manual_reason": "Offline client meeting without laptop",
  "notes": "Q2 review",
  "attachment_ids": []
}
```

### 3.4 Approval API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/time-entries/pending-approval` | Manager/admin inbox |
| PATCH | `/time-entries/{id}/approve` | Body: `{ approval_comment?, updated_at }` |
| PATCH | `/time-entries/{id}/reject` | Body: `{ approval_comment, updated_at }` |
| PATCH | `/time-entries/{id}/void` | Admin only; approved → rejected |

### 3.5 Screenshot API

| Method | Path | Idempotency | Description |
|--------|------|:-----------:|-------------|
| POST | `/screenshots/upload` | **Required** | Multipart; header `X-Capture-Slot` |
| GET | `/screenshots` | — | Filters: employee_id, from, to |
| GET | `/screenshots/{id}` | — | Signed URL in response |

### 3.6 Attendance API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/attendance` | List by date range |
| GET | `/attendance/summary` | Monthly rollup |
| PATCH | `/attendance/{id}` | Admin override |
| POST | `/attendance/{id}/reset-auto` | Clear manual override |

### 3.7 Payroll API

| Method | Path | Idempotency | Description |
|--------|------|:-----------:|-------------|
| POST | `/payrolls/generate` | **Required** | Body: `{ period_start, period_end }` |
| GET | `/payrolls` | — | List periods |
| GET | `/payrolls/{id}` | — | Detail + items |
| POST | `/payrolls/{id}/regenerate` | **Required** | Draft only |
| PATCH | `/payrolls/{id}/approve` | — | Lock payroll |
| PATCH | `/payrolls/{id}/mark-paid` | — | Immutable |
| GET | `/payrolls/{id}/export/{format}` | — | pdf, csv, xlsx |

### 3.8 Error Code Map (Domain → HTTP)

| Code | HTTP | Domain Rule |
|------|------|-------------|
| `TIMER_ALREADY_RUNNING` | 409 | T-4 |
| `NO_ACTIVE_TIMER` | 404 | T-4 |
| `INVALID_TIMER_STATE` | 422 | T-4 |
| `EMPLOYEE_INACTIVE` | 403 | T-4 |
| `LOCK_ACQUISITION_FAILED` | 503 | §6.1 |
| `OVERLAPS_ACTIVE_TIMER` | 422 | M-2 |
| `OVERLAPS_EXISTING_ENTRY` | 422 | M-3 |
| `MANUAL_DAILY_LIMIT_EXCEEDED` | 422 | M-6 |
| `ENTRY_MUST_BE_SINGLE_DAY` | 422 | §2.4 |
| `ENTRY_TOO_SHORT` | 422 | §2.4 |
| `CANNOT_APPROVE_OWN_ENTRY` | 403 | M-7 |
| `ALREADY_REVIEWED` | 409 | §6.3 |
| `PAYROLL_LOCKED` | 409 | P-6 |
| `FORBIDDEN` | 403 | RBAC |
| `TENANT_MISMATCH` | 403 | G-5 |

---

## 4. Laravel Implementation Design

### 4.1 Folder Structure

```
backend/
├── app/
│   ├── Console/Commands/
│   │   ├── RecoverOrphanedTimers.php
│   │   └── PurgeExpiredIdempotencyRecords.php
│   ├── Domain/
│   │   ├── TimeTracking/
│   │   │   ├── Services/TimerService.php
│   │   │   ├── Services/ManualTimeEntryService.php
│   │   │   ├── Services/ApprovalService.php
│   │   │   ├── Services/TimeEntryOverlapValidator.php
│   │   │   ├── Services/TimerRedisStore.php
│   │   │   ├── Repositories/TimeEntryRepository.php
│   │   │   ├── Events/TimerStarted.php, TimerStopped.php
│   │   │   ├── Events/ManualEntrySubmitted.php, ManualEntryApproved.php
│   │   │   ├── Jobs/RecoverOrphanedTimersJob.php
│   │   │   └── Policies/TimeEntryPolicy.php
│   │   ├── Screenshot/
│   │   │   ├── Services/ScreenshotService.php
│   │   │   ├── Services/ScreenshotScheduleService.php
│   │   │   ├── Repositories/ScreenshotRepository.php
│   │   │   ├── Jobs/ScreenshotUploadJob.php, RetryFailedScreenshotsJob.php
│   │   │   └── Events/ScreenshotCaptured.php
│   │   ├── Attendance/
│   │   │   ├── Services/AttendanceService.php
│   │   │   ├── Services/AttendanceCalculator.php
│   │   │   ├── Repositories/AttendanceRepository.php
│   │   │   └── Jobs/GenerateAttendanceJob.php, RecalculateAttendanceForDateJob.php
│   │   ├── Payroll/
│   │   │   ├── Services/PayrollCalculatorService.php
│   │   │   ├── Services/PayrollLockService.php
│   │   │   ├── Services/RetroPayrollService.php
│   │   │   ├── Repositories/PayrollRepository.php
│   │   │   ├── Jobs/GeneratePayrollJob.php, GeneratePayrollPdfJob.php
│   │   │   └── Events/PayrollGenerated.php
│   │   └── Shared/
│   │       ├── Concerns/BelongsToOrganization.php
│   │       ├── Scopes/OrganizationScope.php
│   │       ├── Services/TenantContext.php
│   │       ├── Services/AuditLogger.php
│   │       └── Services/IdempotencyService.php
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   ├── TimerController.php
│   │   │   ├── ManualTimeEntryController.php
│   │   │   ├── ApprovalController.php
│   │   │   ├── ScreenshotController.php
│   │   │   ├── AttendanceController.php
│   │   │   └── PayrollController.php
│   │   ├── Middleware/
│   │   │   ├── ResolveTenant.php
│   │   │   ├── EnsureOrganizationAccess.php
│   │   │   ├── IdempotencyMiddleware.php
│   │   │   └── EnforcePayrollLock.php
│   │   ├── Requests/TimeTracking/
│   │   │   ├── StartTimerRequest.php
│   │   │   ├── StopTimerRequest.php
│   │   │   ├── SubmitManualEntryRequest.php
│   │   │   ├── ApproveTimeEntryRequest.php
│   │   │   └── RejectTimeEntryRequest.php
│   │   └── Resources/
│   └── Providers/DomainServiceProvider.php
├── routes/api/v1.php
└── tests/Feature/Domain/
    ├── TimerConcurrencyTest.php
    ├── ManualEntryOverlapTest.php
    └── PayrollLockTest.php
```

### 4.2 Form Request → Domain Rule Mapping

| Form Request | Rules Enforced |
|--------------|----------------|
| `StartTimerRequest` | employee active, org not suspended, project membership |
| `SubmitManualEntryRequest` | project required, reason min 10, single day, no future, duration min 60s, max 12h, backdate limit, daily limits, attachment if org flag |
| `ApproveTimeEntryRequest` | status=pending, not own entry, manager scope OR admin escalation |
| `RejectTimeEntryRequest` | approval_comment min 5 |
| `GeneratePayrollRequest` | period valid, no overlapping processing, idempotency key |

### 4.3 Middleware Stack

```php
Route::prefix('v1')->middleware(['auth:sanctum', 'tenant'])->group(function () {
    Route::post('/timer/start', ...)->middleware('idempotency:optional');
    Route::post('/time-entries/manual', ...)->middleware('idempotency:required');
    Route::post('/payrolls/generate', ...)->middleware(['idempotency:required', 'permission:payroll.generate']);
    Route::patch('/payrolls/{id}', ...)->middleware('payroll.lock');
});
```

---

## 5. Concurrency Implementation Plan

### 5.1 Redis Timer Lock

```php
// TimerRedisStore::acquireLock
$key = "org:{$orgId}:timer:lock:{$employeeId}";
$token = Str::uuid();
$acquired = Redis::set($key, $token, 'EX', 5, 'NX');
if (!$acquired) {
    usleep(50_000); // retry up to 3x
}
// Release: Lua script compare-and-del token
```

**Timer state key:**
```json
// org:{orgId}:timer:{employeeId}
{ "time_entry_id": 42, "status": "running", "last_heartbeat": 1717852800 }
```

### 5.2 Manual Entry Transaction

```php
DB::transaction(function () {
    TimeEntry::where('employee_id', $id)
        ->whereIn('status', ['approved','pending','running','paused'])
        ->where(/* overlap SQL */)
        ->lockForUpdate()
        ->get();
    // if any → throw OverlapException
    TimeEntry::create([...]);
});
```

### 5.3 Payroll Generation Lock

```php
// Redis: org:{orgId}:payroll:generate TTL 300s
// DB: payrolls.status = processing within txn
// On job complete: status → draft (or fail → draft)
```

### 5.4 Screenshot Dedup

```php
$captureSlot = (int) floor($capturedAt->timestamp / $interval);
$idempotencyKey = "{$employeeId}:{$timeEntryId}:{$captureSlot}";
// UNIQUE (time_entry_id, capture_slot) as final guard
```

### 5.5 Failure & Retry

| Component | Retry | Backoff | DLQ |
|-----------|-------|---------|-----|
| Timer lock | 3× 50ms | linear | 503 to client |
| ScreenshotUploadJob | 3 | exponential 30s | `screenshots_failed` table |
| GeneratePayrollJob | 2 | 60s | alert + payroll→draft |
| GenerateAttendanceJob | 3 | 300s | per-org retry next schedule |

---

## 6. Multi-Tenant Architecture

| Layer | Implementation |
|-------|----------------|
| Resolution | `ResolveTenant` middleware: header → subdomain → user default org |
| Eloquent | `BelongsToOrganization` trait auto-sets `organization_id` on create |
| Global scope | `OrganizationScope` on all tenant models |
| Policies | `$model->organization_id === TenantContext::id()` |
| Redis | Prefix `org:{id}:` on all keys |
| S3 | Path `org/{id}/...` |
| Jobs | `TenantAwareJob` restores context in `handle()` |
| Super admin | `withoutGlobalScopes()` only in `/platform/*` controllers |

**Cross-tenant test:** Feature test suite `CrossTenantAccessTest` — every resource ID from org B must 404/403 when authenticated as org A.

---

## 7. Event + Queue Design

### 7.1 Events → Listeners → Jobs

| Event | Listener | Job(s) |
|-------|----------|--------|
| `TimerStarted` | `EnableScreenshotSchedule` | — (Redis only) |
| `TimerStopped` | `DispatchAttendanceRecalc` | `RecalculateAttendanceForDateJob`, `SyncDailyEmployeeHoursJob` |
| `ManualEntrySubmitted` | `NotifyApprover` | `SendManualEntryNotificationJob` |
| `ManualEntryApproved` | `OnManualApproved` | `RecalculateAttendanceForDateJob`, `DetectRetroPayrollAdjustmentJob` |
| `ManualEntryRejected` | `NotifyEmployee` | `SendRejectionNotificationJob` |
| `PayrollGenerated` | `NotifyPayrollReady` | `GeneratePayrollPdfJob` |
| `ScreenshotCaptured` | `UpdateActivityMetrics` | — |
| `PayrollApproved` | `LockPayrollSnapshot` | — |

### 7.2 Queue Assignment

| Queue | Jobs | Workers |
|-------|------|---------|
| `critical` | notifications, timer recovery | 1 |
| `screenshots` | ScreenshotUploadJob, RetryFailedScreenshotsJob | 2–8 |
| `payroll` | GeneratePayrollJob, GeneratePayrollPdfJob | 2 |
| `attendance` | GenerateAttendanceJob, RecalculateAttendanceForDateJob | 2 |
| `default` | SyncDailyEmployeeHoursJob, DetectRetroPayrollAdjustmentJob | 2 |

### 7.3 Scheduler

| Command | Frequency |
|---------|-----------|
| `RecoverOrphanedTimers` | every 5 min |
| `GenerateAttendanceForAllOrgs` | daily 00:30 staggered by org TZ |
| `PurgeScreenshotRetention` | weekly |
| `PurgeIdempotencyRecords` | daily |

---

## 8. Performance & Scaling

### 8.1 Hot Path (Timer)

1. Redis GET active timer (< 5ms)
2. Lock → DB write → Redis SET (< 50ms target)
3. No queue on START/STOP critical path
4. Events dispatched `afterResponse()` or `ShouldDispatchAfterCommit`

### 8.2 Index Strategy (`time_entries`)

| Query | Index |
|-------|-------|
| Active timer | `uq_te_one_active_timer` |
| Payroll sum | `idx_te_payroll (org, employee, status, start_time)` |
| Approval inbox | `idx_te_pending_queue` |
| Overlap check | `idx_te_overlap` + `lockForUpdate` |

### 8.3 Aggregation

- `daily_employee_hours` — updated async on approval events
- Dashboard reads from cache Redis 60s TTL or summary table
- Reports > 90 days use summary table; detail drill-down hits `time_entries`

### 8.4 Scale Milestones

| Employees | Infra |
|-----------|-------|
| < 1k | Single RDS, 2 workers, Redis single node |
| 1k–5k | RDS replica, 4 workers, ElastiCache |
| 5k–10k+ | Partition `time_entries` by month, 8+ screenshot workers, read replica for reports |

---

## 9. Security Model

### 9.1 RBAC Enforcement

```
Request → auth:sanctum → ResolveTenant → Spatie permission → Policy::authorize()
```

Policies enforce manager team scope (`manager_id` hierarchy) for approvals and reports.

### 9.2 Cross-Tenant Prevention

- Global scope on all models
- Route model binding scoped: `TimeEntry::where('organization_id', TenantContext::id())`
- Integration tests mandatory per resource

### 9.3 Payroll Manipulation Prevention

- `approved` payroll: no UPDATE on `payroll_items` amounts — DB trigger or app guard
- Regenerate only `draft`
- Retro hours via `payroll_retro_queue` → next draft only
- All mutations audit logged

### 9.4 Audit Logging

`AuditLogger::log($model, $event, $old, $new)` on:
- time_entry status changes
- payroll status transitions
- attendance manual overrides
- void operations

### 9.5 Immutable Payroll Records

On `payroll.approve`:
- Set `locked_at = now()`
- Snapshot `approved_seconds` per item
- Append-only `payroll_item_adjustments` (no DELETE policy)

---

## Document References

| Doc | Role |
|-----|------|
| [domain-rules.md](../../docs/architecture/domain-rules.md) | Behavioral authority |
| [rbac-permissions.md](../../docs/architecture/rbac-permissions.md) | Permission matrix |
| [frontend-structure.md](../../docs/architecture/frontend-structure.md) | Next.js consumer |

**Next step:** `bmad-create-epics-and-stories` or Sprint 0 scaffold with `TimerService` + concurrency tests first.
