<?php

namespace App\Http\Resources;

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
            'annual_limit_days' => $this->annual_limit_days,
            'used_days' => number_format((float) $this->used_days, 2, '.', ''),
            'remaining_days' => number_format($this->remainingDays(), 2, '.', ''),
            'reset_at' => $this->reset_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
