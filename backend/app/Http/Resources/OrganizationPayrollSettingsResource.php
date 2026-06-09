<?php

namespace App\Http\Resources;

use App\Support\PayrollVaultState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\OrganizationPayrollSettings */
class OrganizationPayrollSettingsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $unlocked = PayrollVaultState::isUnlocked($request);

        return [
            'organization_id' => $this->organization_id,
            'working_days_per_month' => $this->working_days_per_month,
            'working_hours_per_day' => $this->working_hours_per_day,
            'expected_monthly_hours' => $this->expectedMonthlyHours(),
            'deduction_mode' => $this->deduction_mode->value,
            'income_tax_percent' => $unlocked ? $this->income_tax_percent : null,
            'eobi_percent' => $unlocked ? $this->eobi_percent : null,
            'social_security_percent' => $unlocked ? $this->social_security_percent : null,
            'custom_deduction_percent' => $unlocked ? $this->custom_deduction_percent : null,
            'overtime_enabled' => $this->overtime_enabled,
            'overtime_rate_percentage' => $unlocked ? $this->overtime_rate_percentage : null,
            'financial_data_masked' => ! $unlocked,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
