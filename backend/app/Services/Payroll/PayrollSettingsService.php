<?php

namespace App\Services\Payroll;

use App\Enums\PayrollDeductionMode;
use App\Enums\UserRole;
use App\Models\OrganizationPayrollSettings;
use App\Models\User;
use App\Services\Tenant\TenantContext;

class PayrollSettingsService
{
    public function forOrganization(?int $organizationId = null): OrganizationPayrollSettings
    {
        $organizationId ??= TenantContext::id();

        return OrganizationPayrollSettings::query()->firstOrCreate(
            ['organization_id' => $organizationId],
            [
                'working_days_per_month' => OrganizationPayrollSettings::DEFAULT_WORKING_DAYS_PER_MONTH,
                'working_hours_per_day' => OrganizationPayrollSettings::DEFAULT_WORKING_HOURS_PER_DAY,
                'deduction_mode' => PayrollDeductionMode::Percentage,
                'income_tax_percent' => 0,
                'eobi_percent' => 0,
                'social_security_percent' => 0,
                'custom_deduction_percent' => 0,
                'overtime_enabled' => true,
                'overtime_rate_percentage' => 125,
            ]
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(User $admin, array $data): OrganizationPayrollSettings
    {
        $this->ensureAdmin($admin);

        $settings = $this->forOrganization();

        $settings->update($data);

        return $settings->fresh();
    }

    private function ensureAdmin(User $user): void
    {
        if ($user->currentRole() !== UserRole::Admin) {
            abort(403, 'Only admins can manage payroll settings.');
        }
    }
}
