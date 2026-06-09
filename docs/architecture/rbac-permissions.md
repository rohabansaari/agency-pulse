# RBAC Permissions Matrix

Uses **Spatie Laravel Permission** with `teams` enabled (`organization_id` as team).

## Roles

| Role | Scope | Description |
|------|-------|-------------|
| `super_admin` | Platform | No org team; `users.is_super_admin = true` |
| `org_admin` | Organization | Full org control |
| `manager` | Organization | Team oversight, approvals |
| `employee` | Organization | Self-service only |

Users receive roles via `organization_members.role` → synced to Spatie role for that team.

---

## Permissions List

```
# Organization
org.view, org.update

# Departments
departments.view, departments.create, departments.update, departments.delete

# Employees
employees.view, employees.view_all, employees.create, employees.update, employees.delete, employees.invite

# Clients
clients.view, clients.create, clients.update, clients.delete

# Projects
projects.view, projects.create, projects.update, projects.delete, projects.manage_members, projects.view_hours

# Timer & Timesheets
timer.start, timer.stop, timer.pause, timer.view
timesheets.view, timesheets.view_all, timesheets.create_manual, timesheets.approve

# Screenshots
screenshots.upload, screenshots.view, screenshots.view_all, screenshots.review

# Attendance
attendance.view, attendance.view_all, attendance.generate, attendance.override

# Leave
leave.view, leave.view_all, leave.apply, leave.approve, leave.manage_types

# Payroll
payroll.view, payroll.view_all, payroll.generate, payroll.approve, payroll.pay, payroll.adjust, payroll.export, payroll.view_self

# Reports
reports.view, reports.export

# Dashboard
dashboard.admin, dashboard.manager, dashboard.employee

# Platform (super_admin only)
platform.orgs.view, platform.orgs.manage, platform.subscriptions.manage, platform.analytics.view
```

---

## Permission Matrix

| Permission | Super Admin | Org Admin | Manager | Employee |
|------------|:-----------:|:---------:|:-------:|:--------:|
| **Platform** |
| platform.orgs.view | ✅ | — | — | — |
| platform.orgs.manage | ✅ | — | — | — |
| platform.subscriptions.manage | ✅ | — | — | — |
| platform.analytics.view | ✅ | — | — | — |
| **Organization** |
| org.view | ✅ | ✅ | ✅ | ✅ |
| org.update | ✅ | ✅ | — | — |
| **Employees** |
| employees.view | ✅ | ✅ | ✅* | ✅** |
| employees.view_all | ✅ | ✅ | — | — |
| employees.create | ✅ | ✅ | — | — |
| employees.update | ✅ | ✅ | — | — |
| employees.delete | ✅ | ✅ | — | — |
| employees.invite | ✅ | ✅ | — | — |
| **Departments** |
| departments.* | ✅ | ✅ | view | — |
| **Clients & Projects** |
| clients.* | ✅ | ✅ | view | — |
| projects.* | ✅ | ✅ | view, members | view assigned |
| projects.view_hours | ✅ | ✅ | ✅* | — |
| **Time Tracking** |
| timer.* | ✅ | ✅ | ✅ | ✅ |
| timesheets.view | ✅ | ✅ | ✅* | ✅** |
| timesheets.view_all | ✅ | ✅ | — | — |
| timesheets.create_manual | ✅ | ✅ | ✅ | ✅ |
| timesheets.approve | ✅ | ✅ | ✅* | — |
| **Screenshots** |
| screenshots.upload | ✅ | — | — | ✅ |
| screenshots.view | ✅ | ✅ | ✅* | ✅** |
| screenshots.view_all | ✅ | ✅ | — | — |
| screenshots.review | ✅ | ✅ | ✅* | — |
| **Attendance** |
| attendance.view | ✅ | ✅ | ✅* | ✅** |
| attendance.view_all | ✅ | ✅ | — | — |
| attendance.generate | ✅ | ✅ | — | — |
| attendance.override | ✅ | ✅ | — | — |
| **Leave** |
| leave.apply | ✅ | ✅ | ✅ | ✅ |
| leave.approve | ✅ | ✅ | ✅* | — |
| leave.view_all | ✅ | ✅ | ✅* | — |
| leave.manage_types | ✅ | ✅ | — | — |
| **Payroll** |
| payroll.view | ✅ | ✅ | — | — |
| payroll.view_all | ✅ | ✅ | — | — |
| payroll.generate | ✅ | ✅ | — | — |
| payroll.approve | ✅ | ✅ | — | — |
| payroll.pay | ✅ | ✅ | — | — |
| payroll.adjust | ✅ | ✅ | — | — |
| payroll.export | ✅ | ✅ | — | — |
| payroll.view_self | ✅ | ✅ | ✅ | ✅ |
| **Reports** |
| reports.view | ✅ | ✅ | ✅* | — |
| reports.export | ✅ | ✅ | ✅* | — |
| **Dashboard** |
| dashboard.admin | ✅ | ✅ | — | — |
| dashboard.manager | ✅ | — | ✅ | — |
| dashboard.employee | ✅ | — | — | ✅ |

**Legend:**
- ✅* = Scoped to **direct reports** only (manager's team)
- ✅** = **Self** data only

---

## Manager Team Scoping

Managers see only employees where `employees.manager_id = current_employee.id`.

Implemented via:
1. `EmployeePolicy::view()` checks manager hierarchy
2. Repository scope: `->whereManagerId($managerEmployeeId)` when role is manager
3. Middleware `EnsureTeamScope` on report/timesheet routes

---

## Policy Examples

```php
// app/Policies/LeaveRequestPolicy.php
public function approve(User $user, LeaveRequest $request): bool
{
    if ($user->hasPermissionTo('leave.approve')) {
        if ($user->hasRole('org_admin')) return true;
        if ($user->hasRole('manager')) {
            return $request->employee->manager_id === $user->employee->id;
        }
    }
    return false;
}
```

---

## Middleware Stack

```
Route::middleware(['auth:sanctum', 'tenant', 'permission:dashboard.admin'])
```

Super admin routes bypass tenant middleware:

```
Route::prefix('platform')->middleware(['auth:sanctum', 'super_admin'])
```
