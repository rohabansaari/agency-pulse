# SaaS Subscription Readiness Plan

## Business Model

AgencyPulse is sold as **per-organization subscription** based on employee count and feature tier.

---

## Subscription Plans (MVP Seed Data)

| Feature | Starter | Growth | Enterprise |
|---------|---------|--------|------------|
| **Price** | $49/mo | $149/mo | $399/mo |
| **Employees** | Up to 10 | Up to 50 | Up to 200 |
| **Projects** | 5 | 25 | Unlimited |
| **Screenshot monitoring** | ✅ 30-day retention | ✅ 90-day retention | ✅ 365-day retention |
| **Screenshot interval** | 10 min min | 5 min min | 1 min min |
| **Payroll** | ✅ | ✅ | ✅ |
| **Reports export** | CSV | CSV + Excel | CSV + Excel + PDF |
| **API access** | — | — | ✅ |
| **Priority support** | — | Email | Dedicated |
| **Trial** | 14 days | 14 days | 14 days |

Overage (Phase 2): $5/employee/month above plan limit.

---

## Database Readiness

Already included in schema:

```sql
subscription_plans   -- plan definitions + feature JSON
subscriptions        -- org ↔ plan ↔ status ↔ billing period
organizations.status -- active | suspended | trial
organizations.trial_ends_at
```

### Feature Flags (JSON on `subscription_plans.features`)

```json
{
  "screenshots": true,
  "screenshot_retention_days": 90,
  "min_screenshot_interval": 300,
  "payroll": true,
  "reports_pdf": true,
  "reports_excel": true,
  "api_access": false,
  "max_employees": 50,
  "max_projects": 25
}
```

---

## Enforcement Points

| Check | Where | Behavior |
|-------|-------|----------|
| Max employees | `EmployeeService::create()` | Block + upsell message |
| Max projects | `ProjectService::create()` | Block |
| Screenshot enabled | `ScreenshotService::upload()` | 403 if disabled |
| Screenshot interval | Org settings clamped to plan minimum | |
| Retention cleanup | `ProcessScreenshotRetention` job | Per plan days |
| Trial expired | `ResolveTenant` middleware | Read-only mode |
| Suspended org | `ResolveTenant` middleware | 403 all routes |
| Report PDF | `ReportExportService` | Check feature flag |

### `SubscriptionLimitService`

```php
class SubscriptionLimitService
{
    public function canAddEmployee(Organization $org): bool;
    public function canAddProject(Organization $org): bool;
    public function hasFeature(Organization $org, string $feature): bool;
    public function minScreenshotInterval(Organization $org): int;
    public function isTrialExpired(Organization $org): bool;
    public function isSuspended(Organization $org): bool;
}
```

---

## Billing Integration Roadmap

### MVP (Sprint 5)
- Manual plan assignment by super admin
- Trial countdown in UI
- Feature gating active
- Billing page placeholder ("Contact sales" / "Upgrade")

### Phase 2 — Stripe

```
Customer → Stripe Customer (organizations.stripe_customer_id)
Plan     → Stripe Product + Price (sync from subscription_plans)
Sub      → Stripe Subscription (subscriptions.stripe_subscription_id)

Webhooks:
  customer.subscription.updated  → sync status
  customer.subscription.deleted  → suspend org
  invoice.payment_failed         → past_due status
  checkout.session.completed     → activate org
```

### Phase 3 — Self-Serve
- Stripe Checkout for upgrade
- Customer portal for invoice history
- Proration on mid-cycle upgrades
- Annual discount (20%)

---

## Super Admin Capabilities

| Action | API |
|--------|-----|
| View all organizations | `GET /platform/organizations` |
| Suspend org (non-payment) | `PATCH /platform/organizations/{id}/status` |
| Override plan | `PATCH /platform/subscriptions/{id}` |
| Platform MRR dashboard | `GET /platform/analytics` |
| Create/edit plans | `CRUD /platform/plans` |

### Platform Analytics KPIs

- Total organizations (active / trial / suspended)
- MRR / ARR
- Employee seats used vs. licensed
- Churn rate (monthly)
- Screenshot storage (GB per org)
- API request volume

---

## Onboarding Flow

```
Register → Create Organization → 14-day Growth trial (auto)
    → Invite employees → Start tracking
    → Day 10: email reminder
    → Day 14: prompt upgrade or downgrade to free tier (read-only)
```

---

## Multi-Tenant SaaS Checklist

### Security & Compliance
- [ ] Tenant isolation tests (automated)
- [ ] SOC 2 readiness: audit logs, access controls
- [ ] Data residency note (single region MVP; EU region Phase 3)
- [ ] Terms of Service + Privacy Policy pages
- [ ] Employee consent for screenshot monitoring (org setting + onboarding ack)

### Operational
- [ ] Org-level usage metrics dashboard (super admin)
- [ ] Automated trial expiry job
- [ ] Dunning emails (Phase 2 with Stripe)
- [ ] Status page for outages
- [ ] Backup: RDS daily snapshots, S3 versioning

### Legal (Agency-Specific)
- [ ] Screenshot monitoring disclosure template for employee contracts
- [ ] Configurable screenshot opt-out per jurisdiction (Phase 2)
- [ ] Payroll disclaimer (not a tax filing service)

---

## Upgrade Triggers (In-App)

| Trigger | Message |
|---------|---------|
| Employee #11 on Starter | "Upgrade to Growth for up to 50 employees" |
| Project limit hit | "Upgrade for more projects" |
| PDF export on Starter | "Available on Growth plan" |
| Trial day 12 | "2 days left — choose a plan" |
| Storage 80% of plan | "Upgrade for longer screenshot retention" |

---

## Revenue Projections (Conservative)

| Month | Orgs | Avg Plan | MRR |
|-------|------|----------|-----|
| 3 | 10 | $99 | $990 |
| 6 | 40 | $120 | $4,800 |
| 12 | 150 | $140 | $21,000 |

Assumes 60% Growth, 30% Starter, 10% Enterprise mix at maturity.

---

## Technical Debt Accepted in MVP

| Item | Paydown Sprint |
|------|----------------|
| Manual billing | Phase 2 Stripe |
| No desktop agent (API-only upload) | Phase 2 Electron |
| Single DB (no read replica) | At 500+ employees |
| No webhook system | Phase 3 |
