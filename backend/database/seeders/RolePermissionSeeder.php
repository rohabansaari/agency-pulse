<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    /**
     * @var list<string>
     */
    private array $permissions = [
        'org.view', 'org.update',
        'departments.view', 'departments.create', 'departments.update', 'departments.delete',
        'employees.view', 'employees.view_all', 'employees.create', 'employees.update', 'employees.delete', 'employees.invite',
        'clients.view', 'clients.create', 'clients.update', 'clients.delete',
        'projects.view', 'projects.create', 'projects.update', 'projects.delete', 'projects.manage_members', 'projects.view_hours',
        'timer.start', 'timer.stop', 'timer.pause', 'timer.view',
        'timesheets.view', 'timesheets.view_all', 'timesheets.create_manual', 'timesheets.approve',
        'screenshots.upload', 'screenshots.view', 'screenshots.view_all', 'screenshots.review',
        'attendance.view', 'attendance.view_all', 'attendance.generate', 'attendance.override',
        'leave.view', 'leave.view_all', 'leave.apply', 'leave.approve', 'leave.manage_types',
        'payroll.view', 'payroll.view_all', 'payroll.generate', 'payroll.approve', 'payroll.pay', 'payroll.adjust', 'payroll.export', 'payroll.view_self',
        'reports.view', 'reports.export',
        'dashboard.admin', 'dashboard.manager', 'dashboard.employee',
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $guard = 'sanctum';

        foreach ($this->permissions as $permission) {
            Permission::findOrCreate($permission, $guard);
        }

        $rolePermissions = [
            UserRole::Admin->value => $this->permissions,
            UserRole::SubAdmin->value => [
                'org.view',
                'departments.view', 'departments.create', 'departments.update', 'departments.delete',
                'employees.view', 'employees.view_all', 'employees.update',
                'clients.view', 'clients.create', 'clients.update', 'clients.delete',
                'projects.view', 'projects.create', 'projects.update', 'projects.delete', 'projects.manage_members', 'projects.view_hours',
                'timesheets.view', 'timesheets.view_all', 'timesheets.approve',
                'screenshots.view', 'screenshots.view_all', 'screenshots.review',
                'leave.view', 'leave.view_all', 'leave.apply', 'leave.approve', 'leave.manage_types',
                'reports.view', 'reports.export',
                'dashboard.admin',
            ],
            UserRole::Manager->value => [
                'org.view',
                'departments.view',
                'employees.view',
                'clients.view',
                'projects.view', 'projects.create', 'projects.update', 'projects.manage_members', 'projects.view_hours',
                'employees.invite',
                'timer.start', 'timer.stop', 'timer.pause', 'timer.view',
                'timesheets.view', 'timesheets.create_manual', 'timesheets.approve',
                'screenshots.upload', 'screenshots.view', 'screenshots.review',
                'attendance.view',
                'leave.view', 'leave.view_all', 'leave.apply', 'leave.approve',
                'payroll.view_self',
                'reports.view',
                'dashboard.manager',
            ],
            UserRole::Employee->value => [
                'org.view',
                'projects.view',
                'timer.start', 'timer.stop', 'timer.pause', 'timer.view',
                'timesheets.view', 'timesheets.create_manual',
                'screenshots.upload', 'screenshots.view',
                'attendance.view',
                'leave.view', 'leave.apply',
                'payroll.view_self',
                'dashboard.employee',
            ],
        ];

        foreach ($rolePermissions as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName, $guard);
            $role->syncPermissions($permissions);
        }
    }
}
