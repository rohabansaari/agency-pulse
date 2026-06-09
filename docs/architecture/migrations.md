# Laravel Migration Structure

Migrations run in dependency order. Use `php artisan migrate` inside Docker.

## Migration File List

```
database/migrations/
├── 0001_01_01_000000_create_users_table.php
├── 0001_01_01_000001_create_cache_table.php
├── 0001_01_01_000002_create_jobs_table.php
│
├── 2026_01_01_000010_create_subscription_plans_table.php
├── 2026_01_01_000020_create_organizations_table.php
├── 2026_01_01_000030_create_subscriptions_table.php
├── 2026_01_01_000040_create_organization_members_table.php
│
├── 2026_01_01_000050_create_permission_tables.php          # spatie/laravel-permission
├── 2026_01_01_000060_seed_roles_and_permissions.php        # seeder migration
│
├── 2026_01_01_000070_create_departments_table.php
├── 2026_01_01_000080_create_employees_table.php
│
├── 2026_01_01_000090_create_clients_table.php
├── 2026_01_01_000100_create_projects_table.php
├── 2026_01_01_000110_create_project_members_table.php
│
├── 2026_01_01_000120_create_time_entries_table.php
├── 2026_01_01_000130_create_time_entry_pauses_table.php
├── 2026_01_01_000140_create_screenshots_table.php
│
├── 2026_01_01_000150_create_attendance_records_table.php
├── 2026_01_01_000160_create_leave_types_table.php
├── 2026_01_01_000170_create_leave_balances_table.php
├── 2026_01_01_000180_create_leave_requests_table.php
│
├── 2026_01_01_000190_create_payrolls_table.php
├── 2026_01_01_000200_create_payroll_items_table.php
├── 2026_01_01_000210_create_payroll_adjustments_table.php
│
├── 2026_01_01_000220_create_audit_logs_table.php
└── 2026_01_01_000230_create_organization_settings_table.php
```

## Sample Migration — `time_entries`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('task_name')->nullable();
            $table->enum('type', ['automatic', 'manual'])->default('automatic');
            $table->enum('status', ['running', 'paused', 'pending', 'approved', 'rejected'])
                  ->default('running');
            $table->text('manual_reason')->nullable();
            $table->text('approval_comment')->nullable();
            $table->timestamp('start_time');
            $table->timestamp('end_time')->nullable();
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->unsignedInteger('paused_seconds')->default(0);
            $table->unsignedTinyInteger('activity_percentage')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'employee_id', 'start_time']);
            $table->index(['organization_id', 'project_id', 'start_time']);
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_entries');
    }
};
```

## Seeders

```
database/seeders/
├── DatabaseSeeder.php
├── SubscriptionPlanSeeder.php      # Starter, Growth, Enterprise
├── SuperAdminSeeder.php            # platform admin
├── RolePermissionSeeder.php          # org_admin, manager, employee
└── DemoOrganizationSeeder.php        # dev/staging demo data
```

## Model Conventions

- All tenant models use `App\Models\Concerns\BelongsToOrganization` trait
- Global scope: `OrganizationScope` applied via trait
- Use `SoftDeletes` on: organizations, employees, clients, projects, departments
- Use `$casts` for JSON columns: `work_schedule`, `features`
- UUID public IDs via `HasUuid` trait for API exposure

## Foreign Key Rules

| Action | Tables |
|--------|--------|
| `cascadeOnDelete` | organization_id children |
| `nullOnDelete` | optional refs (project_id, manager_id) |
| `restrictOnDelete` | payrolls after approval (use status guard instead) |
