# Backend Structure — Repository & Service Layers

## Folder Structure

```
backend/
├── app/
│   ├── Console/Commands/
│   │   ├── GenerateDailyAttendance.php
│   │   └── ProcessScreenshotRetention.php
│   ├── Enums/
│   │   ├── AttendanceStatus.php
│   │   ├── LeaveRequestStatus.php
│   │   ├── PayrollStatus.php
│   │   ├── SalaryType.php
│   │   └── TimeEntryStatus.php
│   ├── Events/
│   │   ├── TimerStarted.php
│   │   ├── TimerStopped.php
│   │   ├── LeaveApproved.php
│   │   └── PayrollGenerated.php
│   ├── Exceptions/
│   │   ├── TenantNotResolvedException.php
│   │   └── TimerAlreadyRunningException.php
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   ├── Auth/
│   │   │   ├── Platform/
│   │   │   ├── EmployeeController.php
│   │   │   ├── TimerController.php
│   │   │   ├── TimeEntryController.php
│   │   │   ├── ScreenshotController.php
│   │   │   ├── AttendanceController.php
│   │   │   ├── LeaveController.php
│   │   │   ├── PayrollController.php
│   │   │   ├── ReportController.php
│   │   │   └── DashboardController.php
│   │   ├── Middleware/
│   │   │   ├── ResolveTenant.php
│   │   │   ├── EnsureOrganizationAccess.php
│   │   │   └── TrackUserActivity.php
│   │   ├── Requests/          # Form requests per action
│   │   └── Resources/         # API transformers
│   ├── Jobs/
│   │   ├── GenerateAttendanceForOrganization.php
│   │   ├── GeneratePayrollJob.php
│   │   ├── ProcessScreenshotUpload.php
│   │   ├── GenerateReportExport.php
│   │   └── SendLeaveNotification.php
│   ├── Listeners/
│   ├── Models/
│   │   ├── Concerns/
│   │   │   ├── BelongsToOrganization.php
│   │   │   └── HasUuid.php
│   │   ├── Organization.php
│   │   ├── Employee.php
│   │   ├── TimeEntry.php
│   │   └── ...
│   ├── Policies/
│   ├── Providers/
│   │   ├── AppServiceProvider.php
│   │   └── RepositoryServiceProvider.php
│   ├── Repositories/
│   │   ├── Contracts/
│   │   │   ├── EmployeeRepositoryInterface.php
│   │   │   ├── TimeEntryRepositoryInterface.php
│   │   │   ├── ScreenshotRepositoryInterface.php
│   │   │   ├── AttendanceRepositoryInterface.php
│   │   │   ├── LeaveRepositoryInterface.php
│   │   │   ├── PayrollRepositoryInterface.php
│   │   │   └── ReportRepositoryInterface.php
│   │   └── Eloquent/
│   │       ├── EmployeeRepository.php
│   │       ├── TimeEntryRepository.php
│   │       └── ...
│   └── Services/
│       ├── Tenant/
│       │   └── TenantContext.php
│       ├── Timer/
│       │   ├── TimerService.php
│       │   └── TimerRedisStore.php
│       ├── TimeTracking/
│       │   ├── TimeEntryService.php
│       │   ├── ManualTimeEntryService.php   # submit, approve, reject
│       │   └── TimeEntryOverlapValidator.php
│       ├── Screenshot/
│       │   └── ScreenshotService.php
│       ├── Attendance/
│       │   └── AttendanceGeneratorService.php
│       ├── Leave/
│       │   └── LeaveService.php
│       ├── Payroll/
│       │   ├── PayrollCalculatorService.php
│       │   └── PayrollPdfService.php
│       ├── Report/
│       │   └── ReportExportService.php
│       └── Subscription/
│           └── SubscriptionLimitService.php
├── config/
│   ├── tenancy.php
│   ├── permissions.php
│   └── filesystems.php          # s3 disk config
├── database/migrations/
├── database/seeders/
├── routes/
│   ├── api.php
│   └── platform.php
├── tests/
│   ├── Feature/Api/
│   └── Unit/Services/
├── docker/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── supervisord.conf         # php-fpm + queue workers
├── docker-compose.yml
└── composer.json
```

---

## Repository Layer

Repositories encapsulate **data access only** — no business rules.

### Interface Pattern

```php
// app/Repositories/Contracts/TimeEntryRepositoryInterface.php
interface TimeEntryRepositoryInterface
{
    public function findRunningForEmployee(int $employeeId): ?TimeEntry;
    public function getByDateRange(int $orgId, Carbon $from, Carbon $to, array $filters): LengthAwarePaginator;
    public function getApprovedHoursForPeriod(int $employeeId, Carbon $from, Carbon $to): float;
    public function create(array $data): TimeEntry;
    public function update(TimeEntry $entry, array $data): TimeEntry;
}
```

### Binding (RepositoryServiceProvider)

```php
$this->app->bind(TimeEntryRepositoryInterface::class, TimeEntryRepository::class);
$this->app->bind(PayrollRepositoryInterface::class, PayrollRepository::class);
// ... all repositories
```

### Repository Responsibilities

| Repository | Key Methods |
|------------|-------------|
| `EmployeeRepository` | `paginateByOrg`, `findWithDepartment`, `getTeamForManager` |
| `TimeEntryRepository` | `findRunning`, `sumDuration`, `pendingManualEntries` |
| `ScreenshotRepository` | `paginateGallery`, `countByEmployeeDate` |
| `AttendanceRepository` | `upsertDaily`, `summaryByMonth` |
| `LeaveRepository` | `pendingForManager`, `balanceForEmployee` |
| `PayrollRepository` | `findByPeriod`, `lockForApproval` |
| `ReportRepository` | Raw aggregation queries (read-optimized) |

---

## Service Layer

Services contain **business logic** and orchestrate repositories, jobs, and events.

### Layer Flow

```
Controller → FormRequest (validation) → Service → Repository → Model
                              ↓
                         Dispatch Job / Event
```

### Core Services

#### `TimerService`

```php
class TimerService
{
    public function start(Employee $employee, ?int $projectId): TimeEntry;
    public function stop(Employee $employee): TimeEntry;   // sets status=approved
    public function pause(Employee $employee): TimeEntry;
    public function resume(Employee $employee): TimeEntry;
}
```

- Validates: no duplicate running timer, project membership, org subscription limits
- Writes Redis active timer + DB row (`type=automatic`)
- On stop: `status=approved` (system-trusted, counts toward payroll immediately)
- Dispatches `TimerStarted` / `TimerStopped` events

#### `ManualTimeEntryService` ⭐

```php
class ManualTimeEntryService
{
    public function submit(Employee $employee, ManualEntryData $data): TimeEntry;
    public function approve(TimeEntry $entry, User $reviewer, ?string $comment): TimeEntry;
    public function reject(TimeEntry $entry, User $reviewer, string $comment): TimeEntry;
}
```

- Submit → `type=manual`, `status=pending`; **excluded from payroll**
- Approve → `status=approved`; triggers attendance recalc job
- Reject → `approval_comment` required; employee may resubmit
- See [manual-time-entry-system.md](./manual-time-entry-system.md)

#### `AttendanceGeneratorService`

- Runs nightly per org (queued)
- Rules: Present ≥ 4h, Half Day ≥ 2h, Late if first entry > threshold, Absent if no entries & no approved leave

#### `PayrollCalculatorService`

```php
// Hourly: gross = approved_hours × hourly_rate + bonuses - deductions
// Fixed:  gross = monthly_salary + bonuses - deductions
//        (pro-rate if partial month / unpaid leave)
```

#### `LeaveService`

- Validates balance, overlapping requests
- On approve: decrement balance, update attendance for leave dates
- Notifies manager via queued notification

#### `ScreenshotService`

- Validates upload size/type
- Queues `ProcessScreenshotUpload` → resize, thumbnail, S3 put
- Returns signed URL for gallery

#### `ReportExportService`

- Dispatches async export job
- Uses `maatwebsite/excel` + `barryvdh/laravel-dompdf`
- Stores export in S3, returns temporary download URL

---

## Controller Thinness Rule

Controllers must be ≤ 15 lines per action:

```php
public function start(StartTimerRequest $request, TimerService $timer): JsonResponse
{
    $entry = $timer->start(
        employee: $request->employee(),
        projectId: $request->validated('project_id'),
    );

    return TimeEntryResource::make($entry)->response();
}
```

---

## DTOs (optional Phase 2)

Use `spatie/laravel-data` for cross-layer payloads:

- `PayrollGenerationData`
- `ReportFilterData`
- `TimerStateData`
