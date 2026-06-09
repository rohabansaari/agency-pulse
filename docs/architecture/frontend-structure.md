# Frontend Structure — Next.js Pages & Wireframes

## Folder Structure

```
frontend/
├── src/
│   ├── app/                          # App Router (Next.js 15)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (platform)/               # Super Admin
│   │   │   └── platform/
│   │   │       ├── organizations/page.tsx
│   │   │       ├── subscriptions/page.tsx
│   │   │       └── analytics/page.tsx
│   │   ├── (dashboard)/              # Authenticated org routes
│   │   │   ├── layout.tsx            # Sidebar + org switcher
│   │   │   ├── page.tsx              # Role-based redirect
│   │   │   ├── dashboard/
│   │   │   │   ├── admin/page.tsx
│   │   │   │   ├── manager/page.tsx
│   │   │   │   └── employee/page.tsx
│   │   │   ├── employees/
│   │   │   │   ├── page.tsx          # List
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/page.tsx     # Profile
│   │   │   ├── departments/page.tsx
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── time-tracking/
│   │   │   │   ├── page.tsx                  # Timer widget
│   │   │   │   ├── timesheets/daily/page.tsx
│   │   │   │   ├── timesheets/weekly/page.tsx
│   │   │   │   ├── manual/new/page.tsx       # Manual entry form
│   │   │   │   └── approvals/page.tsx        # Manager approval inbox ⭐
│   │   │   ├── screenshots/
│   │   │   │   ├── page.tsx          # Gallery
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── attendance/page.tsx
│   │   │   ├── leave/
│   │   │   │   ├── page.tsx          # My leave + apply
│   │   │   │   ├── requests/page.tsx # Admin/manager approvals
│   │   │   │   └── balances/page.tsx
│   │   │   ├── payroll/
│   │   │   │   ├── page.tsx          # Periods list
│   │   │   │   ├── [id]/page.tsx     # Period detail
│   │   │   │   └── history/page.tsx  # Employee view
│   │   │   ├── reports/
│   │   │   │   ├── employee-hours/page.tsx
│   │   │   │   ├── project-hours/page.tsx
│   │   │   │   ├── payroll/page.tsx
│   │   │   │   ├── attendance/page.tsx
│   │   │   │   └── manual-vs-automatic/page.tsx  # ⭐
│   │   │   └── settings/
│   │   │       ├── organization/page.tsx
│   │   │       ├── profile/page.tsx
│   │   │       └── billing/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # shadcn/ui
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── OrgSwitcher.tsx
│   │   ├── dashboard/
│   │   │   ├── KpiCard.tsx
│   │   │   ├── HoursChart.tsx
│   │   │   └── OnlineEmployees.tsx
│   │   ├── timer/
│   │   │   ├── TimerWidget.tsx
│   │   │   └── ProjectSelector.tsx
│   │   ├── timesheets/
│   │   ├── screenshots/
│   │   │   └── ScreenshotGallery.tsx
│   │   ├── leave/
│   │   ├── payroll/
│   │   └── reports/
│   │       └── ExportButton.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTimer.ts
│   │   ├── useOrganization.ts
│   │   └── usePermissions.ts
│   ├── lib/
│   │   ├── api.ts                    # Axios/fetch wrapper
│   │   ├── auth.ts
│   │   └── utils.ts
│   ├── stores/
│   │   └── timerStore.ts             # Zustand
│   └── types/
│       ├── employee.ts
│       ├── time-entry.ts
│       └── payroll.ts
├── public/
├── docker/
│   └── Dockerfile
├── tailwind.config.ts
├── components.json                   # shadcn config
└── package.json
```

---

## Route Access by Role

| Route | Org Admin | Manager | Employee |
|-------|:---------:|:-------:|:--------:|
| `/dashboard/admin` | ✅ | — | — |
| `/dashboard/manager` | — | ✅ | — |
| `/dashboard/employee` | — | — | ✅ |
| `/employees/*` | ✅ | view team | — |
| `/payroll/*` | ✅ | — | history only |
| `/reports/*` | ✅ | team scope | — |
| `/time-tracking` | ✅ | ✅ | ✅ |
| `/leave/requests` | ✅ | ✅ | — |

Middleware: `src/middleware.ts` checks Sanctum session cookie + redirects unauthenticated.

---

## Wireframes

### Admin Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ☰ AgencyPulse          [Acme Agency ▼]     🔔  👤 Admin                  │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Dashboard  │  Admin Dashboard                          Jun 8, 2026       │
│ Employees  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│ Projects   │ │Online   │ │Hours    │ │Pending  │ │Payroll  │ │Active  ││
│ Time       │ │  12/45  │ │Today    │ │Manual ⚠│ │Month    │ │Projects││
│ Approvals⭐│ │         │ │ 186.5h  │ │   7     │ │ $48,200 │ │   8    ││
│ Screenshots│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘│
│ Attendance │
│ Leave      │ ┌────────────────────────────┐ ┌──────────────────────┐      │
│ Payroll    │ │ Hours This Week (chart)    │ │ Active Projects  8   │      │
│ Reports    │ │ ▁▃▅▇█▆▄                   │ │ ● Website Redesign   │      │
│ Settings   │ └────────────────────────────┘ │ ● SEO Campaign       │      │
│            │ ┌────────────────────────────┐ │ ● Social Ads Q2      │      │
│            │ │ Pending Leave Requests  3  │ └──────────────────────┘      │
│            │ │ Jane D.  Jun 10-12  [✓][✗]│                                │
│            │ │ Mike R.  Jun 15     [✓][✗]│ ┌──────────────────────┐      │
│            │ └────────────────────────────┘ │ Online Now           │      │
│            │                                │ 🟢 Sarah (Design)    │      │
│            │                                │ 🟢 Tom (Dev)         │      │
│            │                                └──────────────────────┘      │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### Employee Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ☰ AgencyPulse                              🔔  👤 Sarah                    │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Dashboard  │  Good morning, Sarah!                                       │
│ Timer      │ ┌──────────────────────────────────────────────────────┐   │
│ Timesheets │ │  ⏱  TIMER          Project: [Website Redesign ▼]     │   │
│ Screenshots│ │                                                      │   │
│ Leave      │ │         02:34:18                                     │   │
│ Payroll    │ │                                                      │   │
│            │ │    [▶ Start]  [⏸ Pause]  [⏹ Stop]                   │   │
│            │ └──────────────────────────────────────────────────────┘   │
│            │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│            │ │ Today        │ │ This Week    │ │ Leave Balance│        │
│            │ │ 5h 42m       │ │ 32h 15m      │ │ Annual: 12d  │        │
│            │ └──────────────┘ └──────────────┘ └──────────────┘        │
│            │ Recent Screenshots                                           │
│            │ [thumb] [thumb] [thumb] [thumb]  → View all                │
│            │ Recent Payroll                                               │
│            │ May 2026  Net: $4,850  [View PDF]                           │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### Time Tracking — Weekly Timesheet

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Weekly Timesheet        Employee: [All ▼]   Week: [◀ Jun 2-8 ▶]         │
├──────────────────────────────────────────────────────────────────────────┤
│ Employee    │ Mon   │ Tue   │ Wed   │ Thu   │ Fri   │ Sat │ Sun │ Total│
│─────────────┼───────┼───────┼───────┼───────┼───────┼─────┼─────┼──────│
│ Sarah K.    │ 8.0   │ 7.5   │ 8.0   │ 6.0   │  —    │  —  │  —  │ 29.5 │
│ Tom B.      │ 8.0   │ 8.0   │ 8.0   │ 8.0   │ 4.0   │  —  │  —  │ 36.0 │
│ Jane D.     │  —    │  —    │  —    │  —    │  —    │  —  │  —  │  0.0 │
├──────────────────────────────────────────────────────────────────────────┤
│ [Export CSV]  [+ Manual Entry]                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Screenshot Gallery

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Screenshots   Employee: [Tom ▼]  Date: [Jun 8 ▼]  Project: [All ▼]    │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│ │ 10:00  │ │ 10:10  │ │ 10:20  │ │ 10:30  │ │ 10:40  │                  │
│ │ ░░░░░  │ │ ░░░░░  │ │ ░░░░░  │ │ ░░░░░  │ │ ░░░░░  │                  │
│ │ 87%    │ │ 92%    │ │ 45% ⚠  │ │ 78%    │ │ 91%    │                  │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                  │
│ Click to expand · ⚠ = flagged low activity                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Payroll Generation

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Payroll > Generate   Period: [Jun 1] to [Jun 30]   [Generate Draft]     │
├──────────────────────────────────────────────────────────────────────────┤
│ Employee      │ Type   │ Hours │ Rate    │ Gross   │ Adj.  │ Net       │
│───────────────┼────────┼───────┼─────────┼─────────┼───────┼───────────│
│ Sarah K.      │ Hourly │ 160   │ $35/hr  │ $5,600  │ -$0   │ $5,600    │
│ Tom B.        │ Fixed  │  —    │ $6,000  │ $6,000  │ +$500 │ $6,500    │
│ Jane D.       │ Hourly │ 120   │ $28/hr  │ $3,360  │ -$200 │ $3,160    │
├──────────────────────────────────────────────────────────────────────────┤
│ Total Net: $15,260          [Approve]  [Export PDF]  [Export CSV]        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Key UI Components (shadcn/ui)

| Component | Usage |
|-----------|-------|
| `DataTable` | Employees, timesheets, payroll, reports |
| `Calendar` | Leave date picker, attendance |
| `Dialog` | Manual entry, leave apply, adjustments |
| `Sheet` | Screenshot lightbox |
| `Badge` | Status chips (Present, Pending, Approved) |
| `Chart` (recharts) | Dashboard hours chart |
| `Command` | Project selector in timer |

---

## State Management

| Concern | Solution |
|---------|----------|
| Auth session | HTTP-only cookie via Sanctum |
| Active timer | Zustand + 1s interval + API sync |
| Server data | TanStack Query (React Query) |
| Org context | React Context + localStorage fallback |
| Permissions | `usePermissions()` hook from `/auth/me` payload |

---

## API Client Pattern

```typescript
// lib/api.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const orgId = getCurrentOrgId();
  if (orgId) config.headers['X-Organization-Id'] = orgId;
  return config;
});
```
