<?php

namespace App\Models;

use App\Enums\PayrollDeductionMode;
use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationPayrollSettings extends Model
{
    use BelongsToOrganization;

    public const DEFAULT_WORKING_DAYS_PER_MONTH = 22;

    public const DEFAULT_WORKING_HOURS_PER_DAY = 8;

    protected $fillable = [
        'organization_id',
        'working_days_per_month',
        'working_hours_per_day',
        'deduction_mode',
        'income_tax_percent',
        'eobi_percent',
        'social_security_percent',
        'custom_deduction_percent',
        'overtime_enabled',
        'overtime_rate_percentage',
    ];

    protected function casts(): array
    {
        return [
            'working_days_per_month' => 'integer',
            'working_hours_per_day' => 'integer',
            'deduction_mode' => PayrollDeductionMode::class,
            'income_tax_percent' => 'decimal:2',
            'eobi_percent' => 'decimal:2',
            'social_security_percent' => 'decimal:2',
            'custom_deduction_percent' => 'decimal:2',
            'overtime_enabled' => 'boolean',
            'overtime_rate_percentage' => 'decimal:2',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function expectedMonthlyHours(): float
    {
        return $this->working_days_per_month * $this->working_hours_per_day;
    }
}
