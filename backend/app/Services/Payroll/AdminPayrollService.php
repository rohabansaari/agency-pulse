<?php

namespace App\Services\Payroll;

use App\Enums\OrganizationMemberStatus;
use App\Enums\SalaryType;
use App\Enums\UserRole;
use App\Models\EmployeeSalaryContract;
use App\Models\OrganizationMember;
use App\Models\SalaryChangeAudit;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Tenant\TenantContext;
use App\Support\DisplayDate;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminPayrollService
{
    public function __construct(
        private readonly AuditLogger $audit
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function createInitialContract(User $employee, array $data, ?User $changedBy = null): EmployeeSalaryContract
    {
        $this->validateContractPayload($data);

        $effectiveFrom = isset($data['effective_from'])
            ? Carbon::parse($data['effective_from'])->startOfDay()
            : now()->startOfDay();

        $salaryType = $this->salaryTypeValue($data['salary_type']);

        $contract = EmployeeSalaryContract::create([
            'organization_id' => TenantContext::id(),
            'user_id' => $employee->id,
            'salary_type' => $salaryType,
            'hourly_rate' => $salaryType === SalaryType::Hourly->value
                ? (string) $data['hourly_rate']
                : null,
            'monthly_salary' => $salaryType === SalaryType::Monthly->value
                ? (string) $data['monthly_salary']
                : null,
            'effective_from' => $effectiveFrom,
            'effective_to' => null,
            'is_active' => true,
        ]);

        if ($changedBy !== null) {
            $newSalary = $salaryType === SalaryType::Hourly->value
                ? (string) $data['hourly_rate']
                : (string) $data['monthly_salary'];

            SalaryChangeAudit::create([
                'organization_id' => TenantContext::id(),
                'employee_id' => $employee->id,
                'changed_by' => $changedBy->id,
                'salary_type' => $salaryType,
                'previous_salary_encrypted' => null,
                'new_salary_encrypted' => $newSalary,
                'effective_date' => $effectiveFrom,
            ]);
        }

        return $contract;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function versionContract(User $admin, User $employee, array $data): EmployeeSalaryContract
    {
        $this->ensureAdmin($admin);
        $this->ensureEmployeeInOrg($employee);
        $this->validateContractPayload($data);

        $effectiveFrom = Carbon::parse($data['effective_from'] ?? now()->toDateString())->startOfDay();

        return DB::transaction(function () use ($admin, $employee, $data, $effectiveFrom) {
            $active = EmployeeSalaryContract::query()
                ->where('organization_id', TenantContext::id())
                ->where('user_id', $employee->id)
                ->where('is_active', true)
                ->lockForUpdate()
                ->get();

            $previousActive = $active->first();
            $previousSalary = null;
            if ($previousActive) {
                $previousSalary = $previousActive->salary_type === SalaryType::Hourly
                    ? (string) ($this->decryptHourlyRate($previousActive) ?? '')
                    : (string) ($this->decryptMonthlySalary($previousActive) ?? '');
            }

            foreach ($active as $contract) {
                $contract->update([
                    'is_active' => false,
                    'effective_to' => $effectiveFrom->copy()->subDay(),
                ]);
            }

            $salaryType = $this->salaryTypeValue($data['salary_type']);
            $newSalary = $salaryType === SalaryType::Hourly->value
                ? (string) $data['hourly_rate']
                : (string) $data['monthly_salary'];

            $contract = EmployeeSalaryContract::create([
                'organization_id' => TenantContext::id(),
                'user_id' => $employee->id,
                'salary_type' => $salaryType,
                'hourly_rate' => $salaryType === SalaryType::Hourly->value
                    ? (string) $data['hourly_rate']
                    : null,
                'monthly_salary' => $salaryType === SalaryType::Monthly->value
                    ? (string) $data['monthly_salary']
                    : null,
                'effective_from' => $effectiveFrom,
                'effective_to' => null,
                'is_active' => true,
            ]);

            SalaryChangeAudit::create([
                'organization_id' => TenantContext::id(),
                'employee_id' => $employee->id,
                'changed_by' => $admin->id,
                'salary_type' => $salaryType,
                'previous_salary_encrypted' => $previousSalary,
                'new_salary_encrypted' => $newSalary,
                'effective_date' => $effectiveFrom,
            ]);

            $this->audit->log('salary_contract.versioned', $contract, $admin, [
                'user_id' => $employee->id,
                'salary_type' => $data['salary_type'],
                'effective_from' => DisplayDate::format($effectiveFrom),
            ]);

            return $contract->fresh('user');
        });
    }

    /**
     * @return array{has_salary: bool, salary_type: string|null}
     */
    public function contractStatusForUser(User $employee): array
    {
        $this->ensureEmployeeInOrg($employee);

        $contract = EmployeeSalaryContract::query()
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $employee->id)
            ->where('is_active', true)
            ->first();

        return [
            'has_salary' => $contract !== null,
            'salary_type' => $contract?->salary_type->value,
        ];
    }

    /**
     * Safe contract payload for HTTP responses — never exposes numeric salary values.
     *
     * @return array<string, mixed>
     */
    public function publicContractPayload(EmployeeSalaryContract $contract): array
    {
        return [
            'id' => $contract->id,
            'user_id' => $contract->user_id,
            'user_name' => $contract->relationLoaded('user') ? $contract->user?->name : null,
            'salary_type' => $contract->salary_type->value,
            'has_salary' => true,
            'hourly_rate' => null,
            'monthly_salary' => null,
            'effective_from' => DisplayDate::format($contract->effective_from),
            'effective_to' => DisplayDate::format($contract->effective_to),
            'is_active' => $contract->is_active,
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function listActiveContracts(): Collection
    {
        return EmployeeSalaryContract::query()
            ->with('user')
            ->where('organization_id', TenantContext::id())
            ->where('is_active', true)
            ->orderBy('user_id')
            ->get()
            ->map(fn (EmployeeSalaryContract $contract) => $this->publicContractPayload($contract));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function contractHistoryForUser(User $employee): Collection
    {
        $this->ensureEmployeeInOrg($employee);

        return EmployeeSalaryContract::query()
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $employee->id)
            ->orderByDesc('effective_from')
            ->get()
            ->map(fn (EmployeeSalaryContract $contract) => $this->publicContractPayload($contract));
    }

    /**
     * Internal payroll calculation payload — not for HTTP responses.
     *
     * @return array<string, mixed>
     */
    public function decryptedContractPayload(EmployeeSalaryContract $contract): array
    {
        return [
            'id' => $contract->id,
            'user_id' => $contract->user_id,
            'user_name' => $contract->relationLoaded('user') ? $contract->user?->name : null,
            'salary_type' => $contract->salary_type->value,
            'hourly_rate' => $contract->salary_type === SalaryType::Hourly
                ? $this->formatMoney($this->decryptHourlyRate($contract))
                : null,
            'monthly_salary' => $contract->salary_type === SalaryType::Monthly
                ? $this->formatMoney($this->decryptMonthlySalary($contract))
                : null,
            'effective_from' => DisplayDate::format($contract->effective_from),
            'effective_to' => DisplayDate::format($contract->effective_to),
            'is_active' => $contract->is_active,
            'financial_data_masked' => false,
        ];
    }

    /**
     * @param  array<string, mixed>  $contract
     * @return array<string, mixed>
     */
    public function maskedContractPayload(array $contract): array
    {
        return [
            ...$contract,
            'hourly_rate' => null,
            'monthly_salary' => null,
            'financial_data_masked' => true,
        ];
    }

    public function decryptHourlyRate(EmployeeSalaryContract $contract): ?float
    {
        if ($contract->salary_type !== SalaryType::Hourly || $contract->hourly_rate === null) {
            return null;
        }

        return (float) $contract->hourly_rate;
    }

    public function decryptMonthlySalary(EmployeeSalaryContract $contract): ?float
    {
        if ($contract->salary_type !== SalaryType::Monthly || $contract->monthly_salary === null) {
            return null;
        }

        return (float) $contract->monthly_salary;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function salaryTypeValue(mixed $type): string
    {
        return $type instanceof SalaryType ? $type->value : (string) $type;
    }

    private function validateContractPayload(array $data): void
    {
        $type = isset($data['salary_type'])
            ? $this->salaryTypeValue($data['salary_type'])
            : null;

        if ($type === SalaryType::Hourly->value && ! isset($data['hourly_rate'])) {
            throw ValidationException::withMessages([
                'hourly_rate' => ['Hourly rate is required for hourly salary contracts.'],
            ]);
        }

        if ($type === SalaryType::Monthly->value && ! isset($data['monthly_salary'])) {
            throw ValidationException::withMessages([
                'monthly_salary' => ['Monthly salary is required for monthly salary contracts.'],
            ]);
        }
    }

    private function ensureAdmin(User $user): void
    {
        if ($user->currentRole() !== UserRole::Admin) {
            abort(403, 'Only admins can manage salary contracts.');
        }
    }

    private function ensureEmployeeInOrg(User $employee): void
    {
        $exists = OrganizationMember::query()
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $employee->id)
            // Salary is set at create-employee time, before the invitation is accepted.
            ->whereIn('status', [OrganizationMemberStatus::Active, OrganizationMemberStatus::Invited])
            ->exists();

        if (! $exists) {
            abort(404);
        }
    }

    private function formatMoney(?float $amount): ?string
    {
        if ($amount === null) {
            return null;
        }

        return number_format($amount, 2, '.', '');
    }
}
