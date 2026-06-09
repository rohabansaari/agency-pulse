<?php

namespace App\Services\Payroll\Deductions;

use App\Enums\PayrollDeductionMode;
use App\Models\OrganizationPayrollSettings;
use App\Services\Payroll\Deductions\Contracts\PayrollDeductionCalculator;
use InvalidArgumentException;

class PayrollDeductionEngine
{
    /** @var array<string, PayrollDeductionCalculator> */
    private array $calculators;

    /**
     * @param  iterable<PayrollDeductionCalculator>  $calculators
     */
    public function __construct(iterable $calculators)
    {
        foreach ($calculators as $calculator) {
            $this->calculators[$calculator->mode()->value] = $calculator;
        }
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function calculate(
        float $grossSalary,
        OrganizationPayrollSettings $settings,
        array $context = []
    ): DeductionBreakdown {
        $calculator = $this->calculators[$settings->deduction_mode->value] ?? null;

        if ($calculator === null) {
            throw new InvalidArgumentException(
                "No payroll deduction calculator registered for mode [{$settings->deduction_mode->value}]."
            );
        }

        return $calculator->calculate($grossSalary, $settings, $context);
    }

    public function supports(PayrollDeductionMode $mode): bool
    {
        return isset($this->calculators[$mode->value]);
    }
}
