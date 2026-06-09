# Domain Rules & System Validation Specification

> **Authority:** This document is the canonical behavioral contract for timer, manual entries, screenshots, attendance, and payroll.  
> **Scope:** Rule refinement only — no feature additions.  
> **Invariant:** `status = 'approved'` is the sole gate for payroll, attendance, and billable reports.

---

## 0. Global Invariants

| ID | Invariant |
|----|-----------|
| G-1 | At most **one** `time_entries` row per employee with `type=automatic` AND `status IN (running, paused)` |
| G-2 | Payroll, attendance, and reports query **only** `status = 'approved'` |
| G-3 | All timestamps stored **UTC** in DB; displayed/computed in `organizations.timezone` |
| G-4 | Every state mutation on time entries, payroll, and approvals writes an `audit_logs` row |
| G-5 | Tenant scope enforced on every read/write via `organization_id` |

---

## 1. Timer System Rules

### 1.1 Source of Truth (Hybrid)

| Layer | Role | TTL / Lifetime |
|-------|------|----------------|
| **MySQL `time_entries`** | Authoritative record of all sessions; legal/audit source | Permanent |
| **Redis `org:{org_id}:timer:{employee_id}`** | Hot path for active timer reads; distributed lock | 24h; deleted on STOP |
| **Redis `org:{org_id}:timer:lock:{employee_id}`** | Mutex for start/stop/pause/resume | 5s lease |

**Rule T-1:** On any Redis/DB mismatch at recovery, **DB wins** for terminal states (`approved`); **Redis wins** only if DB row is `running|paused` and Redis key exists with matching `time_entry_id`.

**Rule T-2:** Every timer mutation executes inside `TimerService` in order:  
`ACQUIRE lock → validate → write DB → write Redis → RELEASE lock`.

### 1.2 Final State Machine (Automatic Only)

```
                    ┌─────────────┐
                    │  (no timer) │
                    └──────┬──────┘
                           │ START [lock acquired, no active row]
                           ▼
                    ┌─────────────┐
              ┌────►│   RUNNING   │◄────┐
              │     └──────┬──────┘     │
              │ RESUME     │ PAUSE      │
              │            ▼            │
              │     ┌─────────────┐     │
              └─────│   PAUSED    │─────┘
                    └──────┬──────┘
                           │ STOP
                           ▼
                    ┌─────────────┐
                    │  APPROVED   │  (terminal — counts toward payroll)
                    └─────────────┘
```

### 1.3 Allowed Transitions

| From | Event | To | Side Effects |
|------|-------|-----|--------------|
| ∅ | `START` | `running` | Insert row; set Redis; enable screenshot schedule |
| `running` | `PAUSE` | `paused` | Insert `time_entry_pauses` row; suspend screenshot schedule |
| `paused` | `RESUME` | `running` | Close pause row; resume screenshot schedule |
| `running` | `STOP` | `approved` | Compute duration; set `end_time`; delete Redis; finalize screenshots |
| `paused` | `STOP` | `approved` | Close open pause; compute duration; delete Redis |
| `running` | `FORCE_STOP` (system) | `approved` | Same as STOP; `approval_comment` = system reason |
| `paused` | `FORCE_STOP` (system) | `approved` | Same as STOP |

### 1.4 Invalid Transitions → System Response

| Invalid Action | HTTP | Error Code | Behavior |
|----------------|------|------------|----------|
| `START` when active timer exists | 409 | `TIMER_ALREADY_RUNNING` | Return existing timer; do not create duplicate |
| `STOP` when no active timer | 404 | `NO_ACTIVE_TIMER` | No-op; idempotent 200 if last stop < 5s ago |
| `PAUSE` when not `running` | 422 | `INVALID_TIMER_STATE` | Reject |
| `RESUME` when not `paused` | 422 | `INVALID_TIMER_STATE` | Reject |
| `START` on inactive employee | 403 | `EMPLOYEE_INACTIVE` | Reject |
| Mutations without lock | — | — | Retry 3× 50ms backoff; then 503 |

### 1.5 Browser Close

**Rule T-5:** Closing the browser does **not** stop the timer. Timer continues server-side.

- Redis key persists; DB row remains `running` or `paused`.
- On next login (any device), `GET /timer/active` returns current state.
- UI reconnects and resumes display; no data loss.

### 1.6 Multiple Devices

**Rule T-6:** One active timer per **employee**, not per device.

| Scenario | Behavior |
|----------|----------|
| Device A running; Device B opens app | B shows read-only active timer; controls enabled on both (last write wins with lock) |
| Device A `START`; Device B `START` simultaneously | Lock ensures one succeeds (201), other gets 409 + existing timer |
| Device A `STOP`; Device B `STOP` simultaneously | First wins; second is idempotent success |
| Device B `START` while A has timer on Project X | 409 — must STOP first |

**Rule T-7:** `last_client_id` stored in Redis for debugging only; not used for authority.

### 1.7 Crash / Server Restart Recovery

**Scheduled job:** `RecoverOrphanedTimers` every 5 minutes.

| Condition | Action |
|-----------|--------|
| DB `running\|paused`, Redis missing | Rebuild Redis from DB row |
| Redis exists, DB row missing or terminal | Delete Redis key; log anomaly |
| DB `running`, no heartbeat > **org.max_timer_hours** (default 12h) | `FORCE_STOP` with reason `AUTO_MAX_DURATION` |
| DB `running`, no heartbeat > **org.idle_auto_stop_hours** (default 4h) AND activity% = 0 on last 3 screenshot slots | `FORCE_STOP` with reason `AUTO_IDLE` |
| Employee terminated while timer active | `FORCE_STOP` immediately on status change |

**Rule T-8:** Heartbeat: desktop agent or web client calls `POST /timer/heartbeat` every 60s while timer active. Web-only MVP uses heartbeat from open tab; if absent, only `max_timer_hours` applies.

### 1.8 Duration Calculation (Automatic)

```
duration_seconds = (end_time - start_time) - paused_seconds
```

- Computed **once** at STOP; stored immutably after `approved`.
- `paused_seconds` = sum of all `time_entry_pauses.duration_seconds`.

---

## 2. Manual Time Entry Rules (Fraud Prevention)

### 2.1 Required Fields

| Field | Rule |
|-------|------|
| `project_id` | Required; employee must be in `project_members` |
| `start_time` | Required; not in future (org TZ) |
| `end_time` | Required; `end_time > start_time` |
| `manual_reason` | Required; min **10** chars; max 500; no whitespace-only |
| `task_name` | Optional; max 255 chars |
| `notes` | Optional; max 2000 chars |
| `attachment` | **Optional** (MVP); if org `require_manual_attachment=true`, min 1 file |

### 2.2 Overlap Rules

**Rule M-1:** Overlap checked against all entries for same `employee_id` where:

```
status IN ('approved', 'pending', 'running', 'paused')
AND time ranges intersect (half-open interval [start, end))
```

**Rule M-2:** Overlap with `running|paused` automatic timer → **reject** with `OVERLAPS_ACTIVE_TIMER`.

**Rule M-3:** Overlap with `approved` → **reject** with `OVERLAPS_EXISTING_ENTRY`.

**Rule M-4:** Overlap with `pending` manual (same employee) → **reject** (prevent duplicate submissions).

**Rule M-5:** Overlap with `rejected` → **allowed** (employee may replace rejected slot).

**SQL interval test:**

```
NOT (new_end <= existing_start OR new_start >= existing_end)
```

### 2.3 Volume Limits (per employee, org timezone day)

| Limit | Default | Org Config Key |
|-------|---------|----------------|
| Max single entry duration | 12 hours | `manual_max_entry_hours` |
| Max manual hours per day | 2 hours | `manual_max_daily_hours` |
| Max manual entries per day | 5 | `manual_max_entries_per_day` |
| Max pending entries total | 10 | `manual_max_pending` |
| Backdating limit | 7 days | `manual_backdate_days` |
| Future dating | 0 days | blocked always |

**Rule M-6:** Exceeding daily manual hours does **not** auto-reject — submission blocked at API with `MANUAL_DAILY_LIMIT_EXCEEDED`.

### 2.4 Automatic Rejection (System, No Manager)

| Trigger | Response |
|---------|----------|
| Validation failure | 422; entry not created |
| Overlap detected | 422; entry not created |
| Employee not on project | 422 |
| Entry spans two calendar days (org TZ) | 422 `ENTRY_MUST_BE_SINGLE_DAY` — split required |
| Duration < 1 minute | 422 `ENTRY_TOO_SHORT` |
| Suspicious: > 3 rejections same reason pattern in 7 days | Flag employee; notify admin (no block) |

### 2.5 Approval Routing

| Condition | Approver |
|-----------|----------|
| Employee has assigned `manager_id` | **Manager** (direct reports scope) |
| No manager assigned | **Org Admin** |
| Submitter is Manager | **Org Admin** only |
| Entry duration > 4 hours OR manual daily total would exceed 4h if approved | **Org Admin** only (escalation) |
| Org Admin submits own entry | **Second Org Admin** or self-approve blocked — requires **another** org_admin |

**Rule M-7:** Manager cannot approve **own** manual entries.

### 2.6 Edit / Delete Rules

| Status | Employee | Manager | Org Admin |
|--------|----------|---------|-----------|
| `pending` | Edit all fields; Cancel (soft-delete → status deleted*) | — | Edit; Cancel |
| `rejected` | Edit + resubmit → `pending` | — | — |
| `approved` | ❌ | ❌ | Void** only |
| `running/paused` | N/A (automatic) | — | — |

\* Cancel = set `deleted_at` (soft delete); excluded from all queries.  
\** Void = admin sets `status=rejected`, `approval_comment` required, triggers payroll/attendance recalc if period unlocked.

### 2.7 Approval Workflow Rules

- **Approve:** optimistic lock on row (`updated_at` check); set `approved`, `approved_by`, `approved_at`
- **Reject:** `approval_comment` min 5 chars required
- **Re-approve rejected:** must resubmit as new `pending` cycle (no direct approve from rejected)
- **Stale pending:** entries pending > 30 days flagged on admin dashboard (not auto-rejected)

---

## 3. Screenshot System Rules

### 3.1 Lifecycle

```
TIMER_START (running)
    → screenshot_schedule ACTIVE
    → every interval: agent uploads OR web stub skips

TIMER_PAUSE
    → screenshot_schedule SUSPENDED (no captures)

TIMER_RESUME
    → screenshot_schedule ACTIVE

TIMER_STOP (approved)
    → screenshot_schedule TERMINATED
    → no further captures for that time_entry_id
```

### 3.2 Capture Conditions (ALL must be true)

1. `time_entry.type = 'automatic'`
2. `time_entry.status = 'running'` (NOT paused)
3. `organizations.screenshot_enabled = true`
4. Elapsed ≥ `organizations.screenshot_interval` since last capture for this entry
5. Employee active; org not suspended

**Rule S-1:** **Manual entries NEVER generate screenshots** (MVP default; not configurable).

### 3.3 Frequency

- Minimum interval: **300s** (5 min) — platform floor
- Default: **600s** (10 min)
- Per-org `screenshot_interval` must be ≥ plan minimum
- Jitter: ±30s random to prevent thundering herd

### 3.4 Pause Behavior

- No screenshots while `paused`
- Pause duration does not count toward "time since last screenshot"
- On resume, first capture eligible after full interval from resume time

### 3.5 Storage & Retention

| Plan | Retention | Action |
|------|-----------|--------|
| Starter | 30 days | Hard delete S3 + DB row |
| Growth | 90 days | Hard delete |
| Enterprise | 365 days | Hard delete |

**Rule S-2:** Orphan screenshots (time_entry deleted) retained 7 days then purged.

### 3.6 Upload Failure Handling

| Failure | Behavior |
|---------|----------|
| Network timeout | Agent retries 3× exponential backoff |
| 4xx validation | Log; skip slot; do not stop timer |
| 5xx server | Queue to `screenshots_retry` up to 24h |
| Missing screenshot in active session | Log gap; **does not** invalidate time entry |
| 3+ consecutive misses in one session | Flag session `screenshot_gap=true` for manager review |

**Rule S-3:** Missing screenshots **never** auto-deduct payroll hours.

---

## 4. Attendance Engine Rules

### 4.1 Input Source

```
worked_seconds(d, employee) = SUM(duration_seconds)
  FROM time_entries
  WHERE employee_id = ?
    AND status = 'approved'
    AND DATE(start_time AT TIME ZONE org_tz) = d
```

- **Pending** and **rejected** manual: excluded
- **Running** automatic: excluded until stopped and approved
- Multi-day entries: split hours by org-TZ calendar date proportionally by second

### 4.2 Expected Hours

```
expected_hours(d) =
  IF holiday(d) OR approved_leave(d): 0
  ELSE employees.work_schedule[day_of_week] OR org.standard_hours_day (default 8)
```

### 4.3 Status Derivation (priority order)

| Priority | Condition | Status |
|----------|-----------|--------|
| 1 | Approved full-day leave or holiday | `leave` / `holiday` |
| 2 | `worked_hours = 0` | `absent` |
| 3 | `worked_hours >= expected_hours * 0.75` AND first_start ≤ `work_start + late_threshold` | `present` |
| 4 | `worked_hours >= expected_hours * 0.75` AND first_start > threshold | `late` |
| 5 | `worked_hours >= expected_hours * 0.50` | `half_day` |
| 6 | `worked_hours > 0` AND `< 50%` | `half_day` |

Defaults: `work_start = 09:00` org TZ, `late_threshold = 15 min` (org config).

### 4.4 Cut-off & Recalculation

| Job | Schedule | Scope |
|-----|----------|-------|
| `GenerateDailyAttendance` | 00:30 org-local (staggered) | Previous calendar day |
| `RecalculateAttendanceForDate` | On-demand (approval, void) | Specific date(s) |

**Rule A-1:** Attendance for day D is **provisional** until D+1 00:30 job runs, then **locked** unless recalc triggered.

**Rule A-2:** Late approval for day D after D+1 job → triggers `RecalculateAttendanceForDate(D)` if attendance not manually overridden.

**Rule A-3:** Admin manual override sets `is_auto_generated=false`; auto job skips unless admin "reset to auto".

### 4.5 Timezone

- All attendance `date` columns are **org-local calendar dates**
- DST: use `organizations.timezone` IANA identifier; never fixed UTC offset

### 4.6 Holidays

- Table `organization_holidays (organization_id, date, name)`
- Holiday → `status=holiday`, `expected_hours=0`, `worked_hours` still computed (overtime tracking only, MVP: stored but no pay impact)

---

## 5. Payroll Engine Specification

### 5.1 Period Definition

| Setting | Options | Default |
|---------|---------|---------|
| `payroll_frequency` | `weekly`, `biweekly`, `monthly`, `custom` | `monthly` |
| `payroll_period_anchor` | e.g. month-start, or Monday for weekly | 1st of month |
| `payroll_timezone` | inherits `organizations.timezone` | — |

Period boundaries computed in org TZ, stored as UTC instants `[period_start, period_end)`.

### 5.2 Time Source (Authoritative Query)

```sql
SELECT SUM(duration_seconds) AS total_seconds
FROM time_entries
WHERE organization_id = ?
  AND employee_id = ?
  AND status = 'approved'
  AND start_time >= :period_start_utc
  AND start_time < :period_end_utc
```

**Rule P-1:** Filter on `start_time`, not `approved_at` (work belongs to period when performed).

**Rule P-2:** Entry started in period but approved after period end → **included** (work-period attribution).

**Rule P-3:** Entry started in period, approved after payroll **locked** → excluded until adjustment (see 5.5).

### 5.3 Rounding

| Step | Policy |
|------|--------|
| Per entry duration | Store exact seconds |
| Sum for payroll | `approved_minutes = FLOOR(total_seconds / 60)` — **round down** (employer-safe default) |
| Display | Show HH:MM:SS exact; payroll uses rounded minutes |
| Money | `ROUND(hours * rate, 2)` banker's rounding HALF_UP |

Org override: `payroll_rounding = floor|nearest` (nearest requires contract flag).

### 5.4 Hourly Calculation

```
approved_hours = FLOOR(total_approved_seconds / 60) / 60
gross_pay = approved_hours * hourly_rate
net_pay = gross_pay + SUM(bonuses) - SUM(deductions)
```

### 5.5 Fixed Salary Calculation

```
gross_pay = monthly_salary * (paid_days_in_period / working_days_in_period)
-- unpaid leave days reduce paid_days
net_pay = gross_pay + bonuses - deductions
```

Hourly employees: overtime **not** calculated in MVP (all hours at base rate). Flag `overtime_enabled=false`.

### 5.6 Payroll Lifecycle & Locking

```
draft → processing → approved → paid
         ↑              │
         └── regenerate ┘ (only if status IN (draft, processing))
```

| Status | Allowed Actions |
|--------|-----------------|
| `draft` | Regenerate, edit adjustments, delete payroll |
| `processing` | Job running; no edits |
| `approved` | **LOCKED** — no regeneration; adjustments require `payroll_adjustment` addendum |
| `paid` | **IMMUTABLE** — reversal only via new correction payroll |

**Rule P-4:** `approved` payroll items snapshot `approved_seconds` per employee at generation time.

**Rule P-5:** Late approvals (work in locked period):

1. Entry approved after payroll `approved` for that period
2. System creates `payroll_adjustment` record type `retro_hours` on **next open draft** payroll
3. Notify org admin: "Retroactive hours pending inclusion"
4. Never silently mutate locked payroll

### 5.7 Regeneration Rules

| Payroll Status | Regenerate? |
|----------------|-------------|
| `draft` | ✅ Full regenerate (idempotent) |
| `processing` | ❌ Wait |
| `approved` | ❌ Use adjustment on next period |
| `paid` | ❌ Correction payroll only |

### 5.8 Idempotency

- `POST /payrolls/generate` requires `Idempotency-Key` header
- Same key within 24h returns existing draft

---

## 6. Concurrency & Data Integrity

### 6.1 Locking Strategy

| Operation | Mechanism |
|-----------|-----------|
| Timer start/stop/pause/resume | Redis `SET NX` lock `org:{id}:timer:lock:{emp_id}` TTL 5s |
| Manual submit | DB transaction + `SELECT ... FOR UPDATE` on overlapping entries |
| Manual approve/reject | Optimistic lock `WHERE id=? AND updated_at=?` |
| Payroll generate | Org-level lock `org:{id}:payroll:generate` TTL 300s |
| Screenshot upload | Idempotency key `employee_id + time_entry_id + capture_slot` |

### 6.2 Double Start Prevention

```
1. ACQUIRE timer lock
2. SELECT active entry FOR UPDATE
3. IF exists → 409
4. INSERT running row
5. SET Redis
6. RELEASE lock
```

Unique partial index (recommended):

```sql
-- Enforced at app layer MVP; DB constraint Phase 2
UNIQUE (employee_id) WHERE type='automatic' AND status IN ('running','paused')
```

### 6.3 Race: Simultaneous Approvals

- First `UPDATE ... WHERE status='pending' AND updated_at=?' wins (affected rows = 1)
- Second gets 409 `ALREADY_REVIEWED`

### 6.4 Duplicate Manual Submissions

- Idempotency-Key on `POST /time-entries/manual` (24h)
- Overlap check inside transaction

### 6.5 Screenshot Queue Collisions

- Capture slot = `FLOOR(captured_at / interval)`
- Unique `(time_entry_id, capture_slot)` prevents duplicate DB rows
- S3 put uses same key → overwrite idempotent

---

## 7. Edge Case Table

| # | Scenario | Expected Behavior | System Response |
|---|----------|-------------------|-----------------|
| E-1 | User closes browser while timer running | Timer continues | Redis + DB persist; reconnect via `GET /timer/active` |
| E-2 | User logs in on phone while timer on desktop | Same timer shown | 409 on second START; both can STOP (idempotent) |
| E-3 | Two simultaneous START requests | One timer only | Lock + 409 for loser |
| E-4 | STOP with no active timer | No duplicate approved rows | 404 or idempotent 200 if just stopped |
| E-5 | Server crash mid-session | Timer survives | Recovery job rebuilds Redis; FORCE_STOP if > max hours |
| E-6 | Timer runs 12+ hours | Auto-stop | FORCE_STOP `AUTO_MAX_DURATION`; notify employee + manager |
| E-7 | Manual entry overlaps active timer | Blocked | 422 `OVERLAPS_ACTIVE_TIMER` |
| E-8 | Manual entry overlaps approved entry | Blocked | 422 `OVERLAPS_EXISTING_ENTRY` |
| E-9 | Manual entry 3h on day with 2h limit | Blocked | 422 `MANUAL_DAILY_LIMIT_EXCEEDED` |
| E-10 | Manager approves own manual entry | Blocked | 403 `CANNOT_APPROVE_OWN_ENTRY` |
| E-11 | Two managers approve same pending entry | One wins | Second gets 409 `ALREADY_REVIEWED` |
| E-12 | Manual approved after payroll locked | Retro adjustment | Add to next draft as `retro_hours`; audit log |
| E-13 | Automatic entry stopped at 23:59, spans midnight | Split attendance | Hours split by org TZ date at STOP |
| E-14 | Pending manual excluded from payroll | Correct exclusion | Payroll sum uses `approved` only |
| E-15 | Rejected manual resubmitted | New pending cycle | Old row stays rejected; new row or resubmit updates |
| E-16 | Screenshot upload fails 3× | Gap logged | Timer continues; session flagged after 3 misses |
| E-17 | Screenshots during pause | No capture | Schedule suspended |
| E-18 | Manual entry submitted | No screenshots | `type=manual` never triggers capture |
| E-19 | Employee on approved leave, works anyway | Both recorded | Attendance = leave (priority); approved hours still in payroll |
| E-20 | Holiday + employee works | Holiday status + hours logged | `status=holiday`; hours counted for payroll if approved |
| E-21 | DST spring-forward day | Correct date split | Use IANA TZ conversion |
| E-22 | Payroll regenerate on draft | Fresh calculation | Overwrites draft items; idempotent key |
| E-23 | Payroll regenerate on approved | Blocked | 409 `PAYROLL_LOCKED` |
| E-24 | Void approved manual entry | Hours removed | Status→rejected; recalc if period unlocked else retro |
| E-25 | Duplicate manual POST (double-click) | One entry | Idempotency-Key dedup |
| E-26 | Employee terminated mid-timer | Force stop | FORCE_STOP; timer ends |
| E-27 | Org suspended | No new timers | 403 on START; existing timers FORCE_STOP within 5 min |
| E-28 | Late approval changes attendance | Recalc day | `RecalculateAttendanceForDate` job queued |
| E-29 | Fixed employee, no time entries | Full salary | `gross = monthly_salary` prorated by calendar |
| E-30 | Hourly employee, 59 seconds approved | Rounds down | 0 minutes counted (`FLOOR` policy) |

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-08 | Initial hardened domain rules |

**Supersedes:** Informal rules in PRD §2–8 where conflicts exist. This document wins.
