<?php

namespace App\Http\Resources;

use App\Support\DisplayDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\OvertimeRequest */
class OvertimeRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user_name' => $this->whenLoaded('user', fn () => $this->user?->name),
            'project_id' => $this->project_id,
            'project_name' => $this->whenLoaded('project', fn () => $this->project?->name),
            'manager_id' => $this->manager_id,
            'manager_name' => $this->whenLoaded('assignedManager', fn () => $this->assignedManager?->name),
            'work_date' => DisplayDate::format($this->work_date),
            'duration_seconds' => $this->duration_seconds,
            'reason' => $this->reason,
            'status' => $this->status->value,
            'reviewed_by' => $this->reviewed_by,
            'reviewer_name' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'rejection_reason' => $this->rejection_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
