<?php

namespace App\Services\Onboarding;

use App\Enums\OrganizationMemberStatus;
use App\Enums\SalaryType;
use App\Enums\UserRole;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Auth\MembershipRoleSync;
use App\Services\Auth\RoleMutationGuard;
use App\Services\Payroll\AdminPayrollService;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OnboardingEmployeeService
{
    public function __construct(
        private readonly MembershipRoleSync $membershipRoleSync,
        private readonly AdminPayrollService $adminPayroll
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     * @return array{member: OrganizationMember, message: string}
     */
    public function createEmployee(array $validated, User $admin): array
    {
        $role = UserRole::tryFrom($validated['role'] ?? UserRole::Employee->value) ?? UserRole::Employee;
        RoleMutationGuard::assertPrivilegedRoleAssignable($admin, $role);

        $membership = DB::transaction(function () use ($validated, $admin, $role) {
            if (OrganizationMember::query()
                ->where('organization_id', TenantContext::id())
                ->whereHas('user', fn ($q) => $q->where('email', $validated['email']))
                ->exists()) {
                throw ValidationException::withMessages([
                    'email' => ['This email is already a member of the organization.'],
                ]);
            }

            $user = User::create([
                'organization_id' => TenantContext::id(),
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make(Str::password(16)),
                'role' => $role,
            ]);

            $membership = OrganizationMember::create([
                'organization_id' => TenantContext::id(),
                'user_id' => $user->id,
                'role' => $role,
                'status' => OrganizationMemberStatus::Invited,
                'invited_at' => now(),
            ]);

            $this->membershipRoleSync->syncFromMembership($membership);

            $contractPayload = $this->contractPayloadFromSalary($validated);
            $this->adminPayroll->createInitialContract($user, $contractPayload, $admin);

            return $membership->load('user');
        });

        return [
            'member' => $membership,
            'message' => 'Employee invited. They can set a password when they first sign in.',
        ];
    }

    /**
     * @return array{created: int, failed: list<array{row: int, errors: list<string>}>, message: string}
     */
    public function importCsv(string $csvContent, User $admin): array
    {
        $lines = preg_split('/\R/', trim($csvContent)) ?: [];
        if ($lines === []) {
            throw ValidationException::withMessages([
                'file' => ['CSV file is empty.'],
            ]);
        }

        $header = str_getcsv(array_shift($lines));
        $normalizedHeader = array_map(fn (string $column) => strtolower(trim($column)), $header);

        foreach (['name', 'email', 'salary', 'salary_type'] as $requiredColumn) {
            if (! in_array($requiredColumn, $normalizedHeader, true)) {
                throw ValidationException::withMessages([
                    'file' => ["CSV must include columns: name, email, salary, salary_type. Missing: {$requiredColumn}"],
                ]);
            }
        }

        $created = 0;
        $failed = [];

        foreach ($lines as $index => $line) {
            if (trim($line) === '') {
                continue;
            }

            $rowNumber = $index + 2;
            $values = str_getcsv($line);
            $row = [];
            foreach ($normalizedHeader as $position => $column) {
                $row[$column] = trim((string) ($values[$position] ?? ''));
            }

            try {
                $validated = validator($row, [
                    'name' => ['required', 'string', 'max:255'],
                    'email' => ['required', 'email', 'max:255'],
                    'salary' => ['required', 'numeric', 'min:0'],
                    'salary_type' => ['required', Rule::in([SalaryType::Hourly->value, SalaryType::Monthly->value])],
                ])->validate();

                $this->createEmployee([
                    'name' => $validated['name'],
                    'email' => $validated['email'],
                    'salary_type' => $validated['salary_type'],
                    'salary' => $validated['salary'],
                ], $admin);

                $created++;
            } catch (ValidationException $exception) {
                $failed[] = [
                    'row' => $rowNumber,
                    'errors' => collect($exception->errors())->flatten()->values()->all(),
                ];
            }
        }

        return [
            'created' => $created,
            'failed' => $failed,
            'message' => "{$created} employee(s) imported.",
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function contractPayloadFromSalary(array $validated): array
    {
        $salaryType = SalaryType::from($validated['salary_type']);
        $salary = (string) $validated['salary'];

        return match ($salaryType) {
            SalaryType::Hourly => [
                'salary_type' => SalaryType::Hourly->value,
                'hourly_rate' => $salary,
            ],
            SalaryType::Monthly => [
                'salary_type' => SalaryType::Monthly->value,
                'monthly_salary' => $salary,
            ],
        };
    }
}
