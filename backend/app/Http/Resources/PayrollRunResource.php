<?php

namespace App\Http\Resources;

use App\Support\DisplayDate;
use App\Support\PayrollVaultState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PayrollRun */
class PayrollRunResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $unlocked = PayrollVaultState::isUnlocked($request);

        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'period_start' => DisplayDate::format($this->period_start),
            'period_end' => DisplayDate::format($this->period_end),
            'status' => $this->status->value,
            'total_hours_snapshot' => $this->total_hours_snapshot,
            'total_pay_snapshot' => $unlocked ? $this->total_pay_snapshot : null,
            'total_gross_snapshot' => $unlocked ? $this->total_pay_snapshot : null,
            'total_net_snapshot' => $unlocked ? $this->total_net_snapshot : null,
            'financial_data_masked' => ! $unlocked,
            'created_by' => $this->created_by,
            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'finalized_by' => $this->finalized_by,
            'finalized_by_name' => $this->whenLoaded('finalizer', fn () => $this->finalizer?->name),
            'finalized_at' => DisplayDate::format($this->finalized_at),
            'locked_by' => $this->locked_by,
            'locked_by_name' => $this->whenLoaded('locker', fn () => $this->locker?->name),
            'locked_at' => DisplayDate::format($this->locked_at),
            'created_at' => DisplayDate::format($this->created_at),
            'updated_at' => DisplayDate::format($this->updated_at),
            'entries' => PayrollRunEntryResource::collection($this->whenLoaded('entries')),
            'employee_records' => PayrollRunEmployeeRecordResource::collection($this->whenLoaded('employeeRecords')),
            'entry_count' => $this->whenCounted('entries'),
            'employee_record_count' => $this->whenCounted('employeeRecords'),
        ];
    }
}
