<?php

namespace App\Services\Onboarding;

use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Services\Payroll\PayrollSettingsService;
use App\Services\Payroll\PayrollVaultService;
use App\Services\Tenant\TenantContext;

class OnboardingService
{
    public const TOTAL_STEPS = 5;

    /** @var list<int> */
    public const OPTIONAL_STEPS = [3, 4, 5];

    public function __construct(
        private readonly PayrollVaultService $payrollVault,
        private readonly PayrollSettingsService $payrollSettings
    ) {}

    public function requiresOnboarding(User $user, Organization $organization): bool
    {
        if ($user->isSuperAdmin()) {
            return false;
        }

        if ($user->currentRole() !== UserRole::Admin) {
            return false;
        }

        return ! $organization->onboarding_completed;
    }

    /**
     * @return array<string, mixed>
     */
    public function status(User $user, Organization $organization): array
    {
        $organization = $this->refreshSkippedSteps($organization);
        $pinConfigured = $this->payrollVault->hasPayrollPin($organization);
        $organizationComplete = filled($organization->name);

        return [
            'requires_onboarding' => $this->requiresOnboarding($user, $organization),
            'onboarding_completed' => (bool) $organization->onboarding_completed,
            'onboarding_step' => (int) ($organization->onboarding_step ?: 1),
            'completion_percent' => $this->completionPercent($organization),
            'organization' => [
                'name' => $organization->name,
                'timezone' => $organization->timezone,
                'logo_url' => $organization->logo_url,
                'website' => $organization->website,
            ],
            'pin_configured' => $pinConfigured,
            'requirements_met' => $organizationComplete && $pinConfigured,
            'skipped_steps' => $this->skippedSteps($organization),
            'follow_up_steps' => $organization->onboarding_completed
                ? $this->skippedSteps($organization)
                : [],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateOrganization(Organization $organization, array $data): Organization
    {
        $organization->update([
            'name' => $data['name'],
            'timezone' => $data['timezone'] ?? null,
            'logo_url' => $data['logo_url'] ?? null,
            'website' => $data['website'] ?? null,
            'onboarding_step' => max((int) $organization->onboarding_step, 2),
        ]);

        return $organization->fresh();
    }

    public function updateStep(Organization $organization, int $step): Organization
    {
        $organization->update([
            'onboarding_step' => max(1, min(self::TOTAL_STEPS, $step)),
        ]);

        return $organization->fresh();
    }

    public function markStepSkipped(Organization $organization, int $step): Organization
    {
        if (! in_array($step, self::OPTIONAL_STEPS, true)) {
            return $organization;
        }

        $skipped = collect($organization->onboarding_skipped_steps ?? [])
            ->push($step)
            ->unique()
            ->sort()
            ->values()
            ->all();

        $organization->update(['onboarding_skipped_steps' => $skipped]);

        return $organization->fresh();
    }

    public function markStepCompleted(Organization $organization, int $step): Organization
    {
        if (! in_array($step, self::OPTIONAL_STEPS, true)) {
            return $organization;
        }

        $skipped = collect($organization->onboarding_skipped_steps ?? [])
            ->reject(fn (int $value) => $value === $step)
            ->values()
            ->all();

        $organization->update(['onboarding_skipped_steps' => $skipped]);

        return $organization->fresh();
    }

    public function tryMarkComplete(Organization $organization): Organization
    {
        if ($organization->onboarding_completed) {
            return $organization;
        }

        if (! filled($organization->name)) {
            return $organization;
        }

        if (! $this->payrollVault->hasPayrollPin($organization)) {
            return $organization;
        }

        $organization->update([
            'onboarding_completed' => true,
            'onboarding_step' => self::TOTAL_STEPS,
        ]);

        return $organization->fresh();
    }

    public function enableOvertimeForOrganization(?Organization $organization = null): void
    {
        $organization ??= TenantContext::get();
        $this->payrollSettings->forOrganization($organization->id)->update([
            'overtime_enabled' => true,
        ]);
    }

    private function refreshSkippedSteps(Organization $organization): Organization
    {
        $skipped = collect($organization->onboarding_skipped_steps ?? []);

        if ($skipped->contains(3) && $this->organizationHasWorkforceMembers($organization)) {
            $skipped = $skipped->reject(fn (int $step) => $step === 3);
        }

        if ($skipped->contains(4) && Team::query()->where('organization_id', $organization->id)->exists()) {
            $skipped = $skipped->reject(fn (int $step) => $step === 4);
        }

        if ($skipped->contains(5) && Project::query()->where('organization_id', $organization->id)->exists()) {
            $skipped = $skipped->reject(fn (int $step) => $step === 5);
        }

        $next = $skipped->values()->all();

        if ($next !== ($organization->onboarding_skipped_steps ?? [])) {
            $organization->update(['onboarding_skipped_steps' => $next]);

            return $organization->fresh();
        }

        return $organization;
    }

    private function organizationHasWorkforceMembers(Organization $organization): bool
    {
        return User::query()
            ->where('organization_id', $organization->id)
            ->where('role', '!=', UserRole::Admin)
            ->exists();
    }

    /**
     * @return list<int>
     */
    private function skippedSteps(Organization $organization): array
    {
        return array_values(array_map(
            'intval',
            $organization->onboarding_skipped_steps ?? []
        ));
    }

    private function completionPercent(Organization $organization): int
    {
        if ($organization->onboarding_completed) {
            return 100;
        }

        $step = max(1, min(self::TOTAL_STEPS, (int) ($organization->onboarding_step ?: 1)));

        return min(99, (int) round(($step / self::TOTAL_STEPS) * 100));
    }
}
