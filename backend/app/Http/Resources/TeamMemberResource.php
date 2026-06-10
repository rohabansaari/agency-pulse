<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\OrganizationMember */
class TeamMemberResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'name' => $this->user?->name,
            'email' => $this->user?->email,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'joined_at' => $this->joined_at,
            'created_at' => $this->created_at,
            'team_id' => $this->when(isset($this->team_id), $this->team_id),
            'team_name' => $this->when(isset($this->team_name), $this->team_name),
            'manager_id' => $this->when(isset($this->manager_id), $this->manager_id),
            'manager_name' => $this->when(isset($this->manager_name), $this->manager_name),
            'last_activity_at' => $this->when(isset($this->last_activity_at), $this->last_activity_at),
            'has_active_timer' => $this->when(isset($this->has_active_timer), (bool) $this->has_active_timer),
            'assigned_projects_count' => $this->when(
                isset($this->assigned_projects_count),
                $this->assigned_projects_count
            ),
            'time_tracked_month_seconds' => $this->when(
                isset($this->time_tracked_month_seconds),
                $this->time_tracked_month_seconds
            ),
            'approved_leave_seconds' => $this->when(
                isset($this->approved_leave_seconds),
                $this->approved_leave_seconds
            ),
            'overtime_requests_count' => $this->when(
                isset($this->overtime_requests_count),
                $this->overtime_requests_count
            ),
        ];
    }
}
