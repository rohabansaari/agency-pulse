# Agency Workforce Management SaaS — Architecture Index

> Hubstaff-inspired MVP for digital marketing agencies  
> Stack: Laravel 12 · MySQL · Redis · Next.js · Sanctum · Docker/AWS

| # | Deliverable | Document |
|---|-------------|----------|
| 🏗️ | **Final system architecture** | [system-architecture-final.md](../../_bmad-output/planning-artifacts/system-architecture-final.md) |
| 🔒 | **Domain rules (canonical)** | [domain-rules.md](./domain-rules.md) |
| ⭐ | **Manual time entry system** | [manual-time-entry-system.md](./manual-time-entry-system.md) |
| 1 | Database schema | [database-schema.md](./database-schema.md) |
| 2 | ERD relationships | [database-schema.md#erd](./database-schema.md#erd) |
| 3 | Laravel migrations | [migrations.md](./migrations.md) |
| 4 | API endpoints | [api-endpoints.md](./api-endpoints.md) |
| 5 | Repository pattern | [backend-structure.md#repository-layer](./backend-structure.md#repository-layer) |
| 6 | Service layer | [backend-structure.md#service-layer](./backend-structure.md#service-layer) |
| 7 | RBAC matrix | [rbac-permissions.md](./rbac-permissions.md) |
| 8 | Queue architecture | [infrastructure.md#queue-architecture](./infrastructure.md#queue-architecture) |
| 9 | File storage | [infrastructure.md#file-storage](./infrastructure.md#file-storage) |
| 10 | Multi-tenant design | [infrastructure.md#multi-tenant-architecture](./infrastructure.md#multi-tenant-architecture) |
| 11 | Next.js pages | [frontend-structure.md](./frontend-structure.md) |
| 12 | Dashboard wireframes | [frontend-structure.md#wireframes](./frontend-structure.md#wireframes) |
| 13 | Sprint roadmap | [implementation-roadmap.md](./implementation-roadmap.md) |
| 14 | Folder structure | [backend-structure.md](./backend-structure.md) · [frontend-structure.md](./frontend-structure.md) |
| 15 | Subscription readiness | [subscription-plan.md](./subscription-plan.md) |
| 16 | Scalability (10k+ users) | [scalability-plan.md](./scalability-plan.md) |

## Product Name (working)

**AgencyPulse** — Multi-tenant workforce management for digital agencies.

## Architecture Principles

1. **Tenant isolation first** — Every business row carries `organization_id`; middleware enforces scope.
2. **API-first** — Next.js consumes Laravel REST API via Sanctum SPA/token auth.
3. **Async by default** — Screenshots, attendance, payroll, exports run on queues.
4. **Audit everything** — Payroll, leave approvals, manual time entries are immutable-event logged.
5. **Scale path** — Single DB + Redis today; read replicas + S3 + horizontal workers at 10k+ employees.
