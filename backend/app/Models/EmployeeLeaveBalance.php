<?php

namespace App\Models;

use App\Enums\LeaveCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeLeaveBalance extends Model
{
    protected $fillable = [
        'organization_id',
        'user_id',
        'medical_limit_days',
        'medical_used_days',
        'casual_limit_days',
        'casual_used_days',
        'annual_limit_days',
        'used_days',
        'reset_at',
    ];

    protected function casts(): array
    {
        return [
            'medical_used_days' => 'decimal:2',
            'casual_used_days' => 'decimal:2',
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

    public function remainingDays(?LeaveCategory $category = null): float
    {
        return $this->remainingDaysForCategory($category ?? LeaveCategory::Annual);
    }

    public function remainingDaysForCategory(LeaveCategory $category): float
    {
        return max(0, $this->limitDaysForCategory($category) - $this->usedDaysForCategory($category));
    }

    public function limitDaysForCategory(LeaveCategory $category): float
    {
        return match ($category) {
            LeaveCategory::Medical => (float) ($this->medical_limit_days ?? 10),
            LeaveCategory::Casual => (float) ($this->casual_limit_days ?? 10),
            LeaveCategory::Annual => (float) $this->annual_limit_days,
        };
    }

    public function usedDaysForCategory(LeaveCategory $category): float
    {
        return match ($category) {
            LeaveCategory::Medical => (float) ($this->medical_used_days ?? 0),
            LeaveCategory::Casual => (float) ($this->casual_used_days ?? 0),
            LeaveCategory::Annual => (float) $this->used_days,
        };
    }
}
