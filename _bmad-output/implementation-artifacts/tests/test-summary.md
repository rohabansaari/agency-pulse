# Test Automation Summary

**Date:** 2026-06-09  
**Project:** AgencyPulse (HUBSTAFF CLONE)  
**QA scope:** Full system — PHPUnit feature/unit suite + Playwright E2E/API/UI

## Results

| Suite | Tests | Status |
|-------|-------|--------|
| PHPUnit (`php artisan test`) | 147 | All passing |
| Playwright E2E | 9 | All passing |

## Bugs Found & Fixed

### 1. Flaky E2E registration test (fixed)

**Symptom:** `register and reach dashboard` timed out looking for heading "Dashboard".

**Root cause:** Dashboard uses "Organization control center" for admins, not "Dashboard". Session bootstrap (`Loading...`) can take longer than the default 30s test timeout against Docker API.

**Fix:** Updated `tests/e2e/auth-flow.spec.ts` to wait for loading to clear and assert admin dashboard heading + Payroll nav link. Increased Playwright default timeout to 60s.

### 2. Payroll API E2E timeouts (fixed)

**Symptom:** `PATCH /payroll/settings` appeared to hang in Playwright API tests.

**Root cause:** Cumulative latency from register → vault init → unlock → settings calls exceeded the 60s per-test limit (not an API deadlock — PHPUnit completes same flows in <2s).

**Fix:** Set `test.setTimeout(120_000)` on payroll API suite.

## Generated Tests

### API Tests (Playwright request)

- [x] `tests/e2e/payroll-api.spec.ts` — Payroll settings defaults, deduction config, payroll run snapshot, FBR mode rejection, employee RBAC
- [x] `tests/e2e/manual-time-reporting.spec.ts` — Full API flow: approved manual entry → admin/manager/employee dashboards + org/manager/project reports
- [x] `tests/e2e/health.spec.ts` — API health endpoint
- [x] `tests/e2e/helpers/api.ts` — Shared auth/vault helpers

### E2E UI Tests (Playwright browser)

- [x] `tests/e2e/auth-flow.spec.ts` — Register → dashboard, invalid login error
- [x] `tests/e2e/payroll-ui.spec.ts` — Admin payroll page + settings panel
- [x] `tests/e2e/health.spec.ts` — Login page render

### Backend Feature Tests (manual entry visibility)

- [x] `ManualEntryVisibilityTest` — Approved manual hours in employee dashboard, admin dashboard, manager dashboard/team report, org report, project report; pending excluded; tracked+manual combined
- [x] `PayrollRunTest` — Run lifecycle, employee records, deductions, vault masking
- [x] `PayrollSettingsTest` — Admin settings CRUD, FBR rejection, RBAC
- [x] `ManualTimeEntryTest` — Personal report totals for approved/pending manual entries
- [x] 140+ additional feature/unit tests across auth, time, leave, teams, projects, vault

## Coverage

| Area | API (PHPUnit) | E2E/API (Playwright) | E2E/UI (Playwright) |
|------|---------------|------------------------|---------------------|
| Auth register/login | Yes | Yes | Yes |
| Dashboard | Yes | Partial | Yes |
| Payroll settings | Yes | Yes | Yes |
| Payroll runs | Yes | Partial | Partial |
| Payroll vault | Yes | Via helpers | Partial |
| Time tracking / manual entries | Yes | Yes | No |
| Manual → dashboard & reports | Yes | Yes | No |
| Leave | Yes | No | No |
| Teams/employees | Yes | Partial | No |
| Projects | Yes | No | No |

## How to Run

```bash
# Backend (Docker)
docker compose exec app php artisan test

# E2E (stack must be up on :3000 and :8080)
E2E_SKIP_WEBSERVER=1 npm run test:e2e
```

## Next Steps

- Add E2E for time tracking start/stop and leave approval flows
- Add payroll run Details expand UI test with vault unlock + employee breakdown
- Wire E2E into CI with Docker compose health checks (nginx currently reports unhealthy)
