# PRD — AgencyPulse Workforce Management SaaS (MVP)

**Product:** AgencyPulse (working title)  
**Author:** John (PM) · **Stakeholder:** AlphaRages  
**Version:** 1.1 · **Date:** 2026-06-08  
**Status:** Ready for architecture + sprint planning

---

## Executive Summary

AgencyPulse is a multi-tenant SaaS for digital marketing agencies to track employee work (automatic timer + **controlled manual entries**), monitor activity via screenshots, manage attendance and leave, and generate payroll from **approved hours only**.

**North-star metric:** % of billable hours captured with < 2% payroll disputes.

**Critical business rule:** Manual time entries are a **trust-controlled workflow** — employees submit freely; managers/admins approve; only `approved` entries affect payroll, attendance, and reports.

---

## Problem Statement

Agency owners lose revenue when:
1. Remote work is invisible (no reliable hour capture)
2. Manual timesheets are gamed or forgotten
3. Payroll is calculated from unverified data
4. Client/project profitability is unknown

Hubstaff solves monitoring; agencies also need **flexible manual logging** (client calls, offline work) with **mandatory approval** before money moves.

---

## Target Users

| Persona | Goal | Pain |
|---------|------|------|
| **Agency Owner (Org Admin)** | Profitability, payroll accuracy | Spreadsheet chaos |
| **Account Manager (Manager)** | Team accountability | Chasing timesheets |
| **Designer/Dev (Employee)** | Log work without friction | Forgot to start timer |
| **Platform Operator (Super Admin)** | SaaS growth | — |

---

## MVP Scope

### In Scope
- Multi-tenant orgs, RBAC (4 roles)
- Employee + department CRUD
- **Automatic timer** (start/stop/pause/resume)
- **Manual time entries** with approval workflow
- Screenshots during active automatic sessions
- Attendance auto-derived from approved hours
- Leave apply/approve + balances
- Clients, projects, team assignment
- Payroll from approved hours only
- Dashboards + reports (incl. manual vs automatic)
- Docker-ready, S3 storage, queue workers

### Out of Scope (v1.1+)
- Desktop agent (Electron) — API-ready in MVP
- Stripe billing — manual plan assignment MVP
- Client portal, SSO, shift scheduling

---

## Module Requirements

### 1. Employee Management
CRUD, departments, hourly/fixed salary, active/inactive, manager assignment.

### 2. Time Tracking (AUTO + MANUAL) ⭐

#### Automatic
- Timer linked to project; pause/resume; activity % from agent
- On stop → `type=automatic`, `status=approved` (system-trusted)
- Screenshots only while `status IN (running, paused)`

#### Manual (IMPORTANT)
Employee submits:
- Project (+ optional task name)
- Start time, end time (or duration)
- **Reason** (required, min 10 chars)
- Notes (optional)

On submit → `type=manual`, `status=pending`

Manager/Admin:
- Approve → `status=approved`, records `approved_by`, `approved_at`
- Reject → `status=rejected`, **approval_comment** required

**Payroll query filter:** `WHERE status = 'approved'` always.

Editable rules:
- Pending/rejected: employee can edit/resubmit
- Approved: immutable (admin override audit only)

### 3. Screenshot Monitoring
Configurable interval (5–10 min); linked to automatic `time_entry_id`; S3 storage; gallery filters.

### 4. Attendance
Nightly job from **approved** entries only:
- Present ≥ 75% expected hours
- Half-day ≥ 50%
- Late: first approved entry after threshold
- Absent: no approved hours + no approved leave

### 5–7. Leave, Clients, Projects
As specified in architecture docs.

### 8. Payroll
```
Hourly:  net = (SUM approved duration) × hourly_rate + bonuses - deductions
Fixed:   net = monthly_salary + bonuses - deductions
         (pro-rate if partial month / unpaid leave)
```
Pending manual entries **never** included.

### 9. Dashboard
**Admin:** hours today, **pending manual count**, payroll MTD, active employees/projects  
**Employee:** approved hours today, pending manual status list, weekly hours, payroll history

### 10. Reporting
Employee hours, project/client hours, payroll, attendance, **manual vs automatic hours**.

---

## Non-Functional Requirements

| Area | Target |
|------|--------|
| API latency (p95) | < 300ms reads, < 500ms writes |
| Timer start/stop | < 200ms |
| Uptime | 99.5% MVP |
| Tenants | 500 orgs, 10k employees |
| Screenshots | 1000 uploads/hr/org |
| Security | Tenant isolation, audit on payroll/approval |

---

## Success Criteria (MVP Launch)

- [ ] Employee completes full timer session → appears in payroll
- [ ] Manual entry pending → excluded from payroll → approved → included
- [ ] Manager rejects manual entry with comment → employee notified
- [ ] Attendance reflects approved hours only
- [ ] Admin exports payroll PDF with correct totals

---

## Related Artifacts

| Artifact | Location |
|----------|----------|
| Full architecture (12 deliverables) | `docs/architecture/` |
| Manual entry deep-dive | `docs/architecture/manual-time-entry-system.md` |
| Epics & stories | _Next: run `bmad-create-epics-and-stories`_ |
