<?php

namespace App\Http\Resources;

use App\Enums\LeaveCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\EmployeeLeaveBalance */
class LeaveBalanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'medical_limit_days' => (int) ($this->medical_limit_days ?? 10),
            'medical_used_days' => number_format((float) ($this->medical_used_days ?? 0), 2, '.', ''),
            'medical_remaining_days' => number_format($this->remainingDaysForCategory(LeaveCategory::Medical), 2, '.', ''),
            'casual_limit_days' => (int) ($this->casual_limit_days ?? 10),
            'casual_used_days' => number_format((float) ($this->casual_used_days ?? 0), 2, '.', ''),
            'casual_remaining_days' => number_format($this->remainingDaysForCategory(LeaveCategory::Casual), 2, '.', ''),
            'annual_limit_days' => $this->annual_limit_days,
            'used_days' => number_format((float) $this->used_days, 2, '.', ''),
            'remaining_days' => number_format($this->remainingDaysForCategory(LeaveCategory::Annual), 2, '.', ''),
            'reset_at' => $this->reset_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
