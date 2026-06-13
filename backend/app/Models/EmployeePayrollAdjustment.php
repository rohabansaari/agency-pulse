<?php

namespace App\Models;

use App\Enums\PayrollComponentType;
use App\Enums\PayrollComponentValueMode;
use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeePayrollAdjustment extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'user_id',
        'name',
        'type',
        'value_mode',
        'value',
        'effective_month',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'type' => PayrollComponentType::class,
            'value_mode' => PayrollComponentValueMode::class,
            'value' => 'decimal:2',
            'effective_month' => 'date:Y-m-d',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
