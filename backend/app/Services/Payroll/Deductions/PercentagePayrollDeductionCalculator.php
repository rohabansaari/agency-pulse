<?php

namespace App\Services\Payroll\Deductions;

use App\Enums\PayrollDeductionMode;
use App\Models\OrganizationPayrollSettings;
use App\Services\Payroll\Deductions\Contracts\PayrollDeductionCalculator;

class PercentagePayrollDeductionCalculator implements PayrollDeductionCalculator
{
    public function mode(): PayrollDeductionMode
    {
        return PayrollDeductionMode::Percentage;
    }

    public function calculate(
        float $grossSalary,
        OrganizationPayrollSettings $settings,
        array $context = []
    ): DeductionBreakdown {
        return new DeductionBreakdown(
            incomeTax: $this->percentOf($grossSalary, (float) $settings->income_tax_percent),
            eobi: $this->percentOf($grossSalary, (float) $settings->eobi_percent),
            socialSecurity: $this->percentOf($grossSalary, (float) $settings->social_security_percent),
            customDeduction: $this->percentOf($grossSalary, (float) $settings->custom_deduction_percent),
        );
    }

    private function percentOf(float $amount, float $percent): float
    {
        if ($amount <= 0 || $percent <= 0) {
            return 0.0;
        }

        return round($amount * ($percent / 100), 2);
    }
}
