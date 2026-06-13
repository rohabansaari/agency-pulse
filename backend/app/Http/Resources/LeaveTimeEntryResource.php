<?php

namespace App\Http\Resources;

use App\Support\DisplayDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TimeEntry */
class LeaveTimeEntryResource extends JsonResource
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
            'organization_id' => $this->organization_id,
            'type' => $this->type->value,
            'project_id' => $this->project_id,
            'project_name' => $this->whenLoaded('project', fn () => $this->project?->name),
            'team_id' => $this->team_id,
            'team_name' => $this->whenLoaded('team', fn () => $this->team?->name),
            'manager_id' => $this->manager_id,
            'manager_name' => $this->whenLoaded('assignedManager', fn () => $this->assignedManager?->name),
            'start_time' => DisplayDate::format($this->start_time),
            'end_time' => DisplayDate::format($this->end_time),
            'duration' => $this->duration,
            'description' => $this->description,
            'is_paid' => $this->is_paid,
            'leave_category' => $this->leave_category ?? 'annual',
            'source' => $this->source?->value,
            'status' => $this->status->value,
            'approved_by' => $this->approved_by,
            'approved_by_name' => $this->whenLoaded('approver', fn () => $this->approver?->name),
            'approved_at' => DisplayDate::format($this->approved_at),
            'created_at' => DisplayDate::format($this->created_at),
            'updated_at' => DisplayDate::format($this->updated_at),
        ];
    }
}
