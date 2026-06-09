<?php

namespace App\Services\Payroll\Deductions\Contracts;

use App\Enums\PayrollDeductionMode;
use App\Models\OrganizationPayrollSettings;
use App\Services\Payroll\Deductions\DeductionBreakdown;

interface PayrollDeductionCalculator
{
    public function mode(): PayrollDeductionMode;

    /**
     * @param  array<string, mixed>  $context
     */
    public function calculate(
        float $grossSalary,
        OrganizationPayrollSettings $settings,
        array $context = []
    ): DeductionBreakdown;
}
