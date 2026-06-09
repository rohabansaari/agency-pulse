# Sprint-Wise Implementation Roadmap

**Total duration:** 12 weeks (6 sprints × 2 weeks)  
**Team assumption:** 2 backend, 2 frontend, 1 QA, 1 DevOps (part-time)

---

## Sprint 0 — Foundation (Week 1–2)

### Goals
Project scaffolding, auth, multi-tenant core, CI/CD.

### Backend
- [ ] Laravel 12 project + Docker Compose (app, nginx, mysql, redis, queue, scheduler)
- [ ] Sanctum SPA auth (login, register, logout, me)
- [ ] Organizations + organization_members tables
- [ ] `ResolveTenant` middleware + `TenantContext`
- [ ] Spatie Permission setup with teams
- [ ] Base API envelope + exception handler
- [ ] Super admin seeder

### Frontend
- [ ] Next.js 15 + Tailwind + shadcn/ui init
- [ ] Auth pages (login, register)
- [ ] Dashboard layout (sidebar, topbar, org switcher shell)
- [ ] API client with Sanctum cookie + org header

### DevOps
- [ ] GitHub Actions: lint, test, Docker build
- [ ] `.env.example` for backend + frontend

### Exit Criteria
User can register an agency, log in, see empty dashboard shell.

---

## Sprint 1 — Employees & Departments (Week 3–4)

### Goals
HR foundation for all downstream modules.

### Backend
- [ ] Migrations: departments, employees
- [ ] EmployeeRepository + EmployeeService
- [ ] CRUD APIs + invite flow (email job)
- [ ] EmployeePolicy + RBAC seed (org_admin, manager, employee)
- [ ] Department CRUD

### Frontend
- [ ] Employees list (DataTable, filters, pagination)
- [ ] Employee create/edit form (salary type toggle, department, manager)
- [ ] Employee profile page
- [ ] Departments management page

### Exit Criteria
Org admin can add 50 employees with departments, assign managers, set hourly/fixed rates.

---

## Sprint 2 — Time Tracking & Projects (Week 5–6)

### Goals
Core timer functionality + client/project hierarchy.

### Backend
- [ ] Migrations: clients, projects, project_members, time_entries, time_entry_pauses
- [ ] TimerService + Redis active timer store
- [ ] Timer APIs: start, stop, pause, resume
- [ ] Daily/weekly timesheet queries
- [ ] Manual time entry + approval workflow
- [ ] Client & project CRUD + member assignment

### Frontend
- [ ] Timer widget (persistent in layout for employees)
- [ ] Project selector component
- [ ] Daily & weekly timesheet views
- [ ] Manual entry dialog + approval queue (admin)
- [ ] Clients & projects pages

### Exit Criteria
Employee runs timer on a project; admin sees timesheets; manual entries require approval.

---

## Sprint 3 — Screenshots & Attendance (Week 7–8)

### Goals
Monitoring layer + automated attendance.

### Backend
- [ ] S3 disk config + ScreenshotService
- [ ] Screenshot upload API (desktop agent ready)
- [ ] ProcessScreenshotUpload job (resize, WebP, thumbnail)
- [ ] Screenshot gallery API with signed URLs
- [ ] AttendanceGeneratorService + nightly scheduled job
- [ ] Attendance CRUD + override + summary API

### Frontend
- [ ] Screenshot gallery (grid, filters, lightbox)
- [ ] Flag/review actions for admins
- [ ] Attendance calendar/table view
- [ ] Attendance summary cards on admin dashboard

### Exit Criteria
Screenshots upload to S3 and appear in gallery; attendance auto-generated from time entries.

---

## Sprint 4 — Leave & Payroll (Week 9–10)

### Goals
HR operations: leave workflow + payroll generation.

### Backend
- [ ] Migrations: leave_types, leave_balances, leave_requests
- [ ] LeaveService (apply, approve, reject, balance tracking)
- [ ] Leave approval updates attendance records
- [ ] Migrations: payrolls, payroll_items, payroll_adjustments
- [ ] PayrollCalculatorService (hourly + fixed logic)
- [ ] GeneratePayrollJob + PDF export (dompdf)
- [ ] Payroll approve/paid workflow + audit log

### Frontend
- [ ] Leave apply form + balance display
- [ ] Leave approval queue (manager + admin)
- [ ] Payroll periods list + generate wizard
- [ ] Payroll detail with adjustments (bonus/deduction dialogs)
- [ ] Employee payroll history + PDF download

### Exit Criteria
Full leave cycle works; admin generates monthly payroll with adjustments and exports PDF.

---

## Sprint 5 — Dashboard, Reports & Platform Admin (Week 11–12)

### Goals
Analytics, exports, super admin, polish, launch readiness.

### Backend
- [ ] Dashboard aggregation endpoints (admin, manager, employee)
- [ ] Report queries: employee hours, project hours, payroll, attendance
- [ ] GenerateReportExport job (CSV, Excel, PDF)
- [ ] Platform admin APIs (orgs, subscriptions, analytics)
- [ ] Subscription limit enforcement (max employees)
- [ ] Rate limiting + security hardening

### Frontend
- [ ] Admin dashboard KPIs + charts
- [ ] Manager dashboard (team scope)
- [ ] Employee dashboard
- [ ] Reports pages with date filters + export buttons
- [ ] Platform admin section
- [ ] Settings: org profile, screenshot interval, billing placeholder

### QA & Launch
- [ ] E2E tests: auth, timer, leave, payroll happy paths
- [ ] Load test: 100 concurrent timers, 1000 screenshot uploads/hr
- [ ] Documentation: API docs (Scramble/OpenAPI), deployment guide
- [ ] Staging deploy on AWS

### Exit Criteria
MVP feature-complete; demo-ready for agency pilot customers.

---

## Post-MVP Backlog (Phase 2)

| Priority | Feature |
|----------|---------|
| P1 | Desktop agent (Electron) for screenshots + activity % |
| P1 | Stripe billing integration |
| P1 | Email notifications (leave, payroll, invites) |
| P2 | Mobile-responsive PWA timer |
| P2 | Client portal (read-only project hours) |
| P2 | Shift scheduling |
| P2 | GDPR data export/delete |
| P3 | SSO (Google/Microsoft) |
| P3 | Webhooks + Zapier |
| P3 | Multi-currency payroll |

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| Screenshot storage costs | WebP compression, retention policy by plan |
| Timer race conditions | Redis lock per employee |
| Payroll calculation errors | Unit tests per salary type; manual review step |
| Tenant data leak | Global scope + policy tests + penetration test |
| Queue backlog at scale | Separate screenshot/report queues, auto-scaling workers |

---

## Definition of Done (per story)

- [ ] Migration + model + factory
- [ ] Repository + service + policy
- [ ] API endpoint + feature test
- [ ] Frontend page/component
- [ ] RBAC permission assigned
- [ ] Audit log for sensitive actions
