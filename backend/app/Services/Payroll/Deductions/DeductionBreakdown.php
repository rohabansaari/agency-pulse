<?php

namespace App\Services\Payroll\Deductions;

readonly class DeductionBreakdown
{
    public function __construct(
        public float $incomeTax,
        public float $eobi,
        public float $socialSecurity,
        public float $customDeduction,
    ) {}

    public function totalDeductions(): float
    {
        return round(
            $this->incomeTax + $this->eobi + $this->socialSecurity + $this->customDeduction,
            2
        );
    }
}
