# Infrastructure — Multi-Tenant, Queues & Storage

## Multi-Tenant Architecture

### Strategy: Shared Database, Row-Level Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                     Request Flow                             │
├─────────────────────────────────────────────────────────────┤
│  Client (Next.js)                                            │
│    → Bearer Token (Sanctum)                                  │
│    → X-Organization-Id header OR subdomain {slug}.app.com    │
│         ↓                                                    │
│  ResolveTenant Middleware                                    │
│    → Validate user belongs to org                            │
│    → Set TenantContext::set($organization)                   │
│    → Set Spatie team_id = organization_id                    │
│         ↓                                                    │
│  OrganizationScope (Global Scope on all tenant models)         │
│    → WHERE organization_id = {current}                       │
└─────────────────────────────────────────────────────────────┘
```

### Tenant Resolution Priority

1. `X-Organization-Id` header (SPA default)
2. Subdomain `{org_slug}.agencypulse.app`
3. User's last-selected org from Redis cache

### `TenantContext` Service

```php
final class TenantContext
{
    private static ?Organization $organization = null;

    public static function set(Organization $org): void;
    public static function id(): int;
    public static function get(): Organization;
    public static function forget(): void;
}
```

### Isolation Guarantees

| Layer | Mechanism |
|-------|-----------|
| Database | `organization_id` FK + composite indexes |
| Eloquent | `BelongsToOrganization` trait + global scope |
| Policies | Verify resource belongs to current tenant |
| Redis | Key prefix `org:{id}:` |
| S3 | Path prefix `{org_id}/` |
| Queues | Job payload includes `organization_id`; job restores tenant context |

### Scale Path (10k+ employees)

| Phase | Employees | Architecture |
|-------|-----------|--------------|
| MVP | 0–500 | Single RDS, 2 queue workers, 1 Redis |
| Growth | 500–5k | RDS read replica, 4–8 workers, ElastiCache |
| Scale | 5k–10k+ | Table partitioning (screenshots, time_entries), CDN for S3, dedicated report DB |

### Super Admin Bypass

Platform routes use `withoutGlobalScope(OrganizationScope::class)` explicitly — never on tenant routes.

---

## Queue Architecture

### Queues (Redis driver)

| Queue Name | Priority | Jobs |
|------------|----------|------|
| `critical` | Highest | Timer sync failures, auth emails |
| `default` | Normal | Leave notifications, audit writes |
| `screenshots` | Normal | Image processing, thumbnail |
| `reports` | Low | CSV/Excel/PDF exports |
| `payroll` | Low | Payroll generation |
| `attendance` | Low | Nightly attendance batch |

### Supervisor Config (Docker)

```ini
[program:queue-critical]
command=php artisan queue:work redis --queue=critical --tries=3
numprocs=1

[program:queue-default]
command=php artisan queue:work redis --queue=default,screenshots --tries=3
numprocs=2

[program:queue-heavy]
command=php artisan queue:work redis --queue=reports,payroll,attendance --tries=2 --timeout=300
numprocs=2
```

### Scheduled Tasks (Laravel Scheduler)

| Schedule | Command/Job | Description |
|----------|-------------|-------------|
| Every minute | `DispatchScreenshotReminders` | Notify desktop agents |
| Daily 00:30 | `GenerateAttendanceForAllOrgs` | Fan-out per org job |
| Daily 01:00 | `CleanupExpiredExports` | Remove temp S3 exports |
| Weekly Sun | `ProcessScreenshotRetention` | Delete > 90 day screenshots per plan |
| Monthly 1st | `SendPayrollReminder` | Notify org admins |

### Job: Tenant-Aware Base

```php
abstract class TenantAwareJob implements ShouldQueue
{
    public function __construct(public int $organizationId) {}

    public function handle(): void
    {
        TenantContext::set(Organization::findOrFail($this->organizationId));
        $this->execute();
    }

    abstract protected function execute(): void;
}
```

### Event → Job Map

| Event | Job/Listener |
|-------|--------------|
| `TimerStopped` | Update attendance preview cache |
| `ScreenshotUploaded` | `ProcessScreenshotUpload` |
| `LeaveApproved` | `UpdateAttendanceForLeaveDates` |
| `PayrollGenerated` | `GeneratePayrollPdfItems` |
| `ReportExportRequested` | `GenerateReportExport` |

---

## File Storage Architecture

### Disks (config/filesystems.php)

```php
'disks' => [
    's3' => [
        'driver' => 's3',
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
        'bucket' => env('AWS_BUCKET'),
    ],
    's3_exports' => [ /* same bucket, different prefix */ ],
],
```

### S3 Path Convention

```
{bucket}/
├── org/{org_id}/
│   ├── screenshots/{employee_id}/{YYYY}/{MM}/{uuid}.webp
│   ├── screenshots/thumbs/{employee_id}/{YYYY}/{MM}/{uuid}_thumb.webp
│   ├── avatars/{user_id}.jpg
│   ├── logos/logo.webp
│   └── exports/{report_type}/{YYYY-MM-DD}_{uuid}.xlsx
└── platform/
    └── assets/
```

### Upload Flow — Screenshots

```
Desktop Agent → POST /screenshots/upload (multipart)
    → Controller validates token + employee
    → Store temp locally
    → Dispatch ProcessScreenshotUpload job
        → Resize to max 1920px, convert WebP
        → Generate 320px thumbnail
        → Put to S3
        → Insert screenshots row
        → Delete temp
    → Return 202 Accepted
```

### Signed URLs

- Gallery uses 15-minute signed URLs via `Storage::temporaryUrl()`
- Never expose raw S3 paths to frontend

### Retention Policy

| Plan | Screenshot Retention |
|------|---------------------|
| Starter | 30 days |
| Growth | 90 days |
| Enterprise | 365 days |

Enforced by weekly `ProcessScreenshotRetention` job.

---

## Docker Compose (AWS-compatible)

```yaml
services:
  app:
    build: ./docker
    volumes: [./:/var/www]
    depends_on: [mysql, redis]

  nginx:
    image: nginx:alpine
    ports: ["8080:80"]
    depends_on: [app]

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: agencypulse
    volumes: [mysql_data:/var/lib/mysql]

  redis:
    image: redis:7-alpine

  queue:
    build: ./docker
    command: supervisord -c /etc/supervisor/conf.d/supervisord.conf
    depends_on: [mysql, redis]

  scheduler:
    build: ./docker
    command: php artisan schedule:work
    depends_on: [mysql, redis]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://nginx/api/v1
```

### AWS Deployment Target

| Component | AWS Service |
|-----------|-------------|
| Compute | ECS Fargate or EC2 ASG |
| Database | RDS MySQL 8 (Multi-AZ) |
| Cache/Queue | ElastiCache Redis |
| Storage | S3 + CloudFront |
| Secrets | AWS Secrets Manager |
| CI/CD | GitHub Actions → ECR → ECS |

---

## Security Checklist

- [ ] Sanctum SPA cookie + CSRF for same-domain; token for desktop agent
- [ ] Rate limit: 60/min auth, 300/min API, 10/min screenshot upload
- [ ] Encrypt PII at rest (RDS encryption)
- [ ] S3 bucket policy: private, IAM role only
- [ ] Audit log on payroll approve, leave approve, manual time approve
- [ ] GDPR: employee data export + delete endpoints (Phase 2)
