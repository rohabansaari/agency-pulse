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
        $stepStates = $this->stepStates($organization, $pinConfigured);

        return [
            'requires_onboarding' => $this->requiresOnboarding($user, $organization),
            'onboarding_completed' => (bool) $organization->onboarding_completed,
            'onboarding_step' => (int) ($organization->onboarding_step ?: 1),
            'completion_percent' => $this->completionPercent($organization, $pinConfigured),
            'step_states' => $stepStates,
            'organization' => [
                'name' => $organization->name,
                'timezone' => $organization->timezone,
                'logo_url' => $organization->logo_url,
                'website' => $organization->website,
            ],
            'pin_configured' => $pinConfigured,
            'requirements_met' => data_get(collect($stepStates)->firstWhere('step', 1), 'completed') === true
                && data_get(collect($stepStates)->firstWhere('step', 2), 'completed') === true,
            'skipped_steps' => $this->skippedSteps($organization),
            'follow_up_steps' => $organization->onboarding_completed
                ? collect($stepStates)
                    ->filter(fn (array $state) => ! $state['completed'])
                    ->pluck('step')
                    ->map(fn (int $step) => $step)
                    ->values()
                    ->all()
                : [],
        ];
    }

    /**
     * @return array<int, array{step: int, title: string, required: bool, completed: bool, skipped: bool}>
     */
    public function stepStates(Organization $organization, ?bool $pinConfigured = null): array
    {
        $pinConfigured ??= $this->payrollVault->hasPayrollPin($organization);
        $skipped = $this->skippedSteps($organization);
        $titles = [
            1 => 'Organization',
            2 => 'Payroll PIN',
            3 => 'Employees',
            4 => 'Teams',
            5 => 'Projects',
        ];

        $states = [];

        foreach ($titles as $step => $title) {
            $completed = match ($step) {
                1 => filled($organization->name),
                2 => $pinConfigured,
                3 => ! in_array(3, $skipped, true) && $this->organizationHasWorkforceMembers($organization),
                4 => ! in_array(4, $skipped, true) && Team::query()->where('organization_id', $organization->id)->exists(),
                5 => ! in_array(5, $skipped, true) && Project::query()->where('organization_id', $organization->id)->exists(),
                default => false,
            };

            $states[$step] = [
                'step' => $step,
                'title' => $title,
                'required' => ! in_array($step, self::OPTIONAL_STEPS, true),
                'completed' => $completed,
                'skipped' => in_array($step, $skipped, true),
            ];
        }

        return array_values($states);
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

    public function setStepCompletion(Organization $organization, int $step, bool $completed): Organization
    {
        if ($completed) {
            return $this->markStepCompleted($organization, $step);
        }

        if (in_array($step, self::OPTIONAL_STEPS, true)) {
            return $this->markStepSkipped($organization, $step);
        }

        return $organization;
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

    private function completionPercent(Organization $organization, ?bool $pinConfigured = null): int
    {
        $states = $this->stepStates($organization, $pinConfigured);
        $completed = collect($states)->where('completed', true)->count();

        if ($organization->onboarding_completed && $completed >= self::TOTAL_STEPS) {
            return 100;
        }

        return (int) round(($completed / self::TOTAL_STEPS) * 100);
    }
}
