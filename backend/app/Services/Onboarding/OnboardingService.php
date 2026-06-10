<?php

namespace App\Services\Onboarding;

use App\Enums\UserRole;
use App\Models\Organization;
use App\Models\User;
use App\Services\Payroll\PayrollVaultService;

class OnboardingService
{
    public function __construct(
        private readonly PayrollVaultService $payrollVault
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
        $pinConfigured = $this->payrollVault->hasPayrollPin($organization);
        $organizationComplete = filled($organization->name);

        return [
            'requires_onboarding' => $this->requiresOnboarding($user, $organization),
            'onboarding_completed' => (bool) $organization->onboarding_completed,
            'onboarding_step' => (int) ($organization->onboarding_step ?: 1),
            'completion_percent' => $this->completionPercent($organization, $pinConfigured, $organizationComplete),
            'organization' => [
                'name' => $organization->name,
                'timezone' => $organization->timezone,
                'logo_url' => $organization->logo_url,
                'website' => $organization->website,
            ],
            'pin_configured' => $pinConfigured,
            'requirements_met' => $organizationComplete && $pinConfigured,
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
            'onboarding_step' => max(1, min(6, $step)),
        ]);

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
            'onboarding_step' => 6,
        ]);

        return $organization->fresh();
    }

    private function completionPercent(
        Organization $organization,
        bool $pinConfigured,
        bool $organizationComplete
    ): int {
        $percent = 0;

        if ($organizationComplete) {
            $percent += 34;
        }

        if ($pinConfigured) {
            $percent += 34;
        }

        $step = max(1, (int) $organization->onboarding_step);
        $percent += min(32, max(0, $step - 2) * 8);

        if ($organization->onboarding_completed) {
            return 100;
        }

        return min(99, $percent);
    }
}
