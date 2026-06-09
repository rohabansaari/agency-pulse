<?php

namespace App\Http\Resources;

use App\Support\PayrollVaultState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PayrollRunEmployeeRecord */
class PayrollRunEmployeeRecordResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $unlocked = PayrollVaultState::isUnlocked($request);

        return [
            'id' => $this->id,
            'payroll_run_id' => $this->payroll_run_id,
            'user_id' => $this->user_id,
            'user_name' => $this->whenLoaded('user', fn () => $this->user?->name),
            'salary_type' => $this->salary_type,
            'payable_hours_seconds' => $this->payable_hours_seconds,
            'regular_hours_seconds' => $this->regular_hours_seconds,
            'regular_pay_snapshot' => $unlocked ? $this->regular_pay_snapshot : null,
            'overtime_hours_seconds' => $this->overtime_hours_seconds,
            'overtime_rate_percent_snapshot' => $unlocked ? $this->overtime_rate_percent_snapshot : null,
            'overtime_pay_snapshot' => $unlocked ? $this->overtime_pay_snapshot : null,
            'hourly_equivalent_snapshot' => $unlocked ? $this->hourly_equivalent_snapshot : null,
            'gross_salary_snapshot' => $unlocked ? $this->gross_salary_snapshot : null,
            'deduction_mode_snapshot' => $this->deduction_mode_snapshot,
            'working_days_per_month_snapshot' => $this->working_days_per_month_snapshot,
            'working_hours_per_day_snapshot' => $this->working_hours_per_day_snapshot,
            'income_tax_percent_snapshot' => $unlocked ? $this->income_tax_percent_snapshot : null,
            'eobi_percent_snapshot' => $unlocked ? $this->eobi_percent_snapshot : null,
            'social_security_percent_snapshot' => $unlocked ? $this->social_security_percent_snapshot : null,
            'custom_deduction_percent_snapshot' => $unlocked ? $this->custom_deduction_percent_snapshot : null,
            'income_tax_snapshot' => $unlocked ? $this->income_tax_snapshot : null,
            'eobi_snapshot' => $unlocked ? $this->eobi_snapshot : null,
            'social_security_snapshot' => $unlocked ? $this->social_security_snapshot : null,
            'custom_deduction_snapshot' => $unlocked ? $this->custom_deduction_snapshot : null,
            'bonuses_snapshot' => $unlocked ? $this->bonuses_snapshot : null,
            'net_salary_snapshot' => $unlocked ? $this->net_salary_snapshot : null,
            'financial_data_masked' => ! $unlocked,
        ];
    }
}
