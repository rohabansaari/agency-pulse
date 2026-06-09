<?php

namespace App\Services\Payroll;

use App\Enums\OrganizationMemberStatus;
use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class PayrollVaultService
{
    public const UNLOCK_TTL_MINUTES = 15;

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
            ->where('role', UserRole::Employee)
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
        $unlocked = $this->isUnlocked($user);
        $expiresAt = $unlocked ? $this->unlockExpiresAt($user) : null;

        return [
            'pin_configured' => $this->hasPayrollPin($organization),
            'vault_unlocked' => $unlocked,
            'unlock_expires_at' => $expiresAt?->toIso8601String(),
            'requires_pin_on_employee_create' => $this->requiresPinOnEmployeeCreate($organization),
            'requires_pin_setup' => ! $this->hasPayrollPin($organization),
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
     * @return array<string, mixed>
     */
    public function unlock(User $user, string $pin): array
    {
        $this->ensureAdmin($user);

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

        $expiresAt = now()->addMinutes(self::UNLOCK_TTL_MINUTES);
        Cache::put($this->cacheKey($organization->id, $user->id), $expiresAt->timestamp, $expiresAt);

        return [
            'vault_unlocked' => true,
            'unlock_expires_at' => $expiresAt->toIso8601String(),
        ];
    }

    public function lock(User $user): void
    {
        $this->ensureAdmin($user);
        Cache::forget($this->cacheKey(TenantContext::id(), $user->id));
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
        $this->lock($admin);
    }

    public function isUnlocked(User $user): bool
    {
        if (! $this->hasPayrollPin()) {
            return false;
        }

        $expiresAt = Cache::get($this->cacheKey(TenantContext::id(), $user->id));

        if (! $expiresAt) {
            return false;
        }

        if (now()->timestamp >= (int) $expiresAt) {
            Cache::forget($this->cacheKey(TenantContext::id(), $user->id));

            return false;
        }

        return true;
    }

    public function assertUnlocked(User $user): void
    {
        if (! $this->isUnlocked($user)) {
            throw ValidationException::withMessages([
                'payroll_vault' => ['Payroll vault is locked. Enter the organization payroll PIN to continue.'],
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

    public function unlockExpiresAt(User $user): ?Carbon
    {
        $expiresAt = Cache::get($this->cacheKey(TenantContext::id(), $user->id));

        if (! $expiresAt) {
            return null;
        }

        return Carbon::createFromTimestamp((int) $expiresAt);
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

    private function cacheKey(int $organizationId, int $userId): string
    {
        return "payroll_vault_unlocked:{$organizationId}:{$userId}";
    }

    private function ensureAdmin(User $user): void
    {
        if ($user->currentRole() !== UserRole::Admin) {
            abort(403, 'Only admins can manage the payroll vault.');
        }
    }
}
