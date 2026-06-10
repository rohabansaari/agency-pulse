<?php

namespace App\Services\Payroll;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Tenant\TenantContext;
use Illuminate\Validation\ValidationException;

class PayrollVaultService
{
    public function __construct(
        private readonly AuditLogger $audit
    ) {}

    public function hasPayrollPin(?Organization $organization = null): bool
    {
        $organization ??= TenantContext::get();

        return $organization->payroll_pin !== null;
    }

    public function employeeCount(?Organization $organization = null): int
    {
        $organization ??= TenantContext::get();

        return OrganizationMember::query()
            ->where('organization_id', $organization->id)
            ->whereIn('role', [UserRole::Employee, UserRole::Manager])
            ->where('status', OrganizationMemberStatus::Active)
            ->count();
    }

    public function requiresPinOnEmployeeCreate(?Organization $organization = null): bool
    {
        $organization ??= TenantContext::get();

        return ! $this->hasPayrollPin($organization) && $this->employeeCount($organization) === 0;
    }

    /**
     * @return array<string, mixed>
     */
    public function status(User $user): array
    {
        $organization = TenantContext::get();

        return [
            'pin_configured' => $this->hasPayrollPin($organization),
            'vault_unlocked' => false,
            'unlock_expires_at' => null,
            'requires_pin_on_employee_create' => $this->requiresPinOnEmployeeCreate($organization),
            'requires_pin_setup' => ! $this->hasPayrollPin($organization),
            'requires_pin_each_access' => true,
        ];
    }

    public function initializePin(User $admin, string $pin): void
    {
        $this->ensureAdmin($admin);

        $organization = TenantContext::get();

        if ($this->hasPayrollPin($organization)) {
            throw ValidationException::withMessages([
                'payroll_pin' => ['Organization payroll PIN is already configured.'],
            ]);
        }

        $this->storePin($organization, $pin);

        $this->audit->log('payroll_pin.initialized', $organization, $admin);
    }

    public function setPinOnFirstEmployee(User $admin, string $pin): void
    {
        $organization = TenantContext::get();

        if ($this->hasPayrollPin($organization)) {
            return;
        }

        $this->storePin($organization, $pin);

        $this->audit->log('payroll_pin.initialized', $organization, $admin, [
            'context' => 'first_employee',
        ]);
    }

    /**
     * Validates PIN for the current request. No server-side session is created.
     *
     * @return array<string, mixed>
     */
    public function unlock(User $user, string $pin): array
    {
        $this->ensureAdmin($user);
        $this->assertValidPin($pin);

        return [
            'vault_unlocked' => true,
            'unlock_expires_at' => null,
            'requires_pin_each_access' => true,
        ];
    }

    public function lock(User $user): void
    {
        $this->ensureAdmin($user);
    }

    public function changePin(User $admin, string $currentPin, string $newPin): void
    {
        $this->ensureAdmin($admin);

        $organization = TenantContext::get();

        if (! $this->hasPayrollPin($organization)) {
            throw ValidationException::withMessages([
                'payroll_pin' => ['Organization payroll PIN has not been configured yet.'],
            ]);
        }

        if (! $this->validatePin($organization, $currentPin)) {
            throw ValidationException::withMessages([
                'current_pin' => ['Current payroll PIN is incorrect.'],
            ]);
        }

        $this->storePin($organization, $newPin);

        $this->audit->log('payroll_pin.changed', $organization, $admin);
    }

    public function isUnlocked(User $user, ?string $pin = null): bool
    {
        if (! $this->hasPayrollPin()) {
            return false;
        }

        if ($pin === null || $pin === '') {
            return false;
        }

        return $this->validatePin(TenantContext::get(), $pin);
    }

    public function assertUnlocked(User $user, ?string $pin = null): void
    {
        $pin ??= request()->header('X-Payroll-Pin');

        if (! $this->isUnlocked($user, is_string($pin) ? $pin : null)) {
            throw ValidationException::withMessages([
                'payroll_vault' => ['Payroll PIN is required. Enter your organization payroll PIN to continue.'],
            ]);
        }
    }

    public function validatePin(Organization $organization, string $pin): bool
    {
        if ($organization->payroll_pin === null) {
            return false;
        }

        return hash_equals((string) $organization->payroll_pin, $pin);
    }

    private function assertValidPin(string $pin): void
    {
        $organization = TenantContext::get();

        if (! $this->hasPayrollPin($organization)) {
            throw ValidationException::withMessages([
                'payroll_pin' => ['Organization payroll PIN has not been configured yet.'],
            ]);
        }

        if (! $this->validatePin($organization, $pin)) {
            throw ValidationException::withMessages([
                'payroll_pin' => ['Incorrect payroll PIN.'],
            ]);
        }
    }

    private function storePin(Organization $organization, string $pin): void
    {
        $this->validatePinFormat($pin);

        $organization->update([
            'payroll_pin' => $pin,
            'payroll_pin_created_at' => now(),
        ]);

        $organization->refresh();
        TenantContext::set($organization);
    }

    private function validatePinFormat(string $pin): void
    {
        if (! preg_match('/^\d{4,8}$/', $pin)) {
            throw ValidationException::withMessages([
                'payroll_pin' => ['Payroll PIN must be 4 to 8 digits.'],
            ]);
        }
    }

    private function ensureAdmin(User $user): void
    {
        if ($user->currentRole() !== UserRole::Admin) {
            abort(403, 'Only admins can manage the payroll vault.');
        }
    }
}
