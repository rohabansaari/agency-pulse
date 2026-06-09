<?php

namespace App\Http\Resources;

use App\Support\DisplayDate;
use App\Support\PayrollVaultState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PayrollRunEntry */
class PayrollRunEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $unlocked = PayrollVaultState::isUnlocked($request);

        return [
            'id' => $this->id,
            'time_entry_id' => $this->time_entry_id,
            'user_id' => $this->user_id,
            'user_name' => $this->whenLoaded('user', fn () => $this->user?->name),
            'entry_type' => $this->entry_type,
            'duration_seconds' => $this->duration_seconds,
            'hourly_rate_snapshot' => $unlocked ? $this->hourly_rate_snapshot : null,
            'pay_snapshot' => $unlocked ? $this->pay_snapshot : null,
            'financial_data_masked' => ! $unlocked,
            'entry_date' => $this->whenLoaded(
                'timeEntry',
                fn () => DisplayDate::format($this->timeEntry?->start_time)
            ),
        ];
    }
}
