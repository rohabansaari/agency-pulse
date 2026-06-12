<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeLeaveBalance extends Model
{
    protected $fillable = [
        'organization_id',
        'user_id',
        'annual_limit_days',
        'used_days',
        'reset_at',
    ];

    protected function casts(): array
    {
        return [
            'used_days' => 'decimal:2',
            'reset_at' => 'datetime',
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

    public function remainingDays(): float
    {
        return max(0, (float) $this->annual_limit_days - (float) $this->used_days);
    }
}
