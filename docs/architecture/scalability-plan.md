# Scalability Plan — 10k+ Employees

## Scale Targets

| Metric | MVP | Growth | Scale |
|--------|-----|--------|-------|
| Organizations | 100 | 1,000 | 5,000+ |
| Employees | 500 | 5,000 | 10,000+ |
| Concurrent timers | 200 | 2,000 | 5,000 |
| Screenshots/day | 50k | 500k | 2M |
| API req/min | 1k | 10k | 50k |

---

## Architecture Layers

```
                    ┌─────────────┐
                    │ CloudFront  │  static + signed screenshot URLs
                    └──────┬──────┘
                    ┌──────▼──────┐
                    │ ALB / Nginx │  TLS termination
                    └──────┬──────┘
         ┌─────────────────┼─────────────────┐
    ┌────▼────┐       ┌────▼────┐      ┌────▼────┐
    │ API x N │       │Next.js  │      │ Workers │
    │ Laravel │       │  SSR    │      │ Queue   │
    └────┬────┘       └─────────┘      └────┬────┘
         │                                    │
    ┌────▼────────────┐              ┌──────▼──────┐
    │ RDS MySQL       │              │ ElastiCache │
    │ Primary + Read  │              │ Redis       │
    │ Replica         │              └─────────────┘
    └─────────────────┘
              │
         ┌────▼────┐
         │ S3      │  screenshots, exports, avatars
         └─────────┘
```

---

## Database Strategy

### Phase 1 (MVP — 0–500 employees/org)
- Single RDS MySQL 8, composite indexes on `(organization_id, …)`
- Connection pooling via PgBouncer-style proxy or RDS Proxy

### Phase 2 (500–5k employees total)
- Read replica for reports + dashboard aggregations
- Materialized summary table `daily_employee_hours` (nightly refresh)
- Redis cache for dashboard KPIs (TTL 60s)

### Phase 3 (5k–10k+ employees)
- Partition `screenshots` and `time_entries` by `captured_at` / `start_time` (monthly)
- Archive screenshots > retention to S3 Glacier
- Dedicated reporting DB fed by CDC (Debezium) or nightly ETL

### Hot Queries Optimized

```sql
-- Payroll (approved only)
SELECT employee_id, SUM(duration_seconds)
FROM time_entries
WHERE organization_id = ? AND status = 'approved'
  AND start_time BETWEEN ? AND ?
GROUP BY employee_id;

-- Pending manual inbox
SELECT * FROM time_entries
WHERE organization_id = ? AND type = 'manual' AND status = 'pending'
ORDER BY created_at ASC LIMIT 50;
```

---

## Redis Strategy

| Use | Key Pattern | Notes |
|-----|-------------|-------|
| Active timers | `org:{id}:timer:{emp_id}` | Sub-ms reads |
| Online presence | `org:{id}:online` SET | Heartbeat every 60s |
| Dashboard cache | `org:{id}:dash:admin` | Invalidate on timer stop |
| Rate limits | `rl:{user_id}:{endpoint}` | Screenshot upload 10/min |
| Approval queue count | `org:{id}:pending_manual` | INCR/DECR on status change |

Cluster mode at 5k+ concurrent connections.

---

## Queue Scaling

| Queue | Workers (MVP) | Workers (Scale) |
|-------|---------------|-----------------|
| screenshots | 2 | 8–16 (auto-scale on depth) |
| payroll | 1 | 4 |
| reports | 1 | 4 |
| attendance | 1 | 2 |
| notifications | 1 | 2 |

Horizon for monitoring; scale ECS tasks on `queue depth > 1000`.

---

## Multi-Tenant Isolation at Scale

- **Never** query without `organization_id` — enforced by global scope + static analysis
- Per-tenant rate limits on expensive endpoints (reports, exports)
- S3 path prefix isolation + IAM bucket policies
- Load test: 100 orgs × 100 employees concurrent timer ops

---

## Cost Controls

| Cost Driver | Mitigation |
|-------------|------------|
| Screenshot storage | WebP, thumbnails, plan-based retention |
| S3 egress | CloudFront signed URLs, 15-min TTL |
| RDS size | Partition + archive old time_entries |
| Queue workers | Scale to zero on `screenshots` queue at night |

---

## Observability

- **APM:** Laravel Telescope (dev), Datadog/New Relic (prod)
- **Alerts:** Queue depth > 5k, API p95 > 1s, RDS CPU > 80%
- **Audit:** All payroll + manual approval actions in `audit_logs`
