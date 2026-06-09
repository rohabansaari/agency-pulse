<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollRunEmployeeRecord extends Model
{
    protected $fillable = [
        'payroll_run_id',
        'user_id',
        'salary_type',
        'payable_hours_seconds',
        'regular_hours_seconds',
        'regular_pay_snapshot',
        'overtime_hours_seconds',
        'overtime_rate_percent_snapshot',
        'overtime_pay_snapshot',
        'hourly_equivalent_snapshot',
        'gross_salary_snapshot',
        'deduction_mode_snapshot',
        'working_days_per_month_snapshot',
        'working_hours_per_day_snapshot',
        'income_tax_percent_snapshot',
        'eobi_percent_snapshot',
        'social_security_percent_snapshot',
        'custom_deduction_percent_snapshot',
        'income_tax_snapshot',
        'eobi_snapshot',
        'social_security_snapshot',
        'custom_deduction_snapshot',
        'bonuses_snapshot',
        'net_salary_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'payable_hours_seconds' => 'integer',
            'regular_hours_seconds' => 'integer',
            'regular_pay_snapshot' => 'decimal:2',
            'overtime_hours_seconds' => 'integer',
            'overtime_rate_percent_snapshot' => 'decimal:2',
            'overtime_pay_snapshot' => 'decimal:2',
            'hourly_equivalent_snapshot' => 'decimal:4',
            'gross_salary_snapshot' => 'decimal:2',
            'working_days_per_month_snapshot' => 'integer',
            'working_hours_per_day_snapshot' => 'integer',
            'income_tax_percent_snapshot' => 'decimal:2',
            'eobi_percent_snapshot' => 'decimal:2',
            'social_security_percent_snapshot' => 'decimal:2',
            'custom_deduction_percent_snapshot' => 'decimal:2',
            'income_tax_snapshot' => 'decimal:2',
            'eobi_snapshot' => 'decimal:2',
            'social_security_snapshot' => 'decimal:2',
            'custom_deduction_snapshot' => 'decimal:2',
            'bonuses_snapshot' => 'decimal:2',
            'net_salary_snapshot' => 'decimal:2',
        ];
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
