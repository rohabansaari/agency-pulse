<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin array<string, mixed> */
class EmployeeProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var \App\Models\OrganizationMember $membership */
        $membership = $this->resource['membership'];

        return [
            'membership_id' => $membership->id,
            'user_id' => $membership->user_id,
            'name' => $membership->user?->name,
            'email' => $membership->user?->email,
            'role' => $membership->role->value,
            'status' => $membership->status->value,
            'joined_at' => $membership->joined_at,
            'team' => $this->resource['team'],
            'assigned_projects' => $this->resource['assigned_projects'],
            'leave_history' => $this->resource['leave_history'],
            'overtime_history' => $this->resource['overtime_history'],
            'time_summary' => $this->resource['time_summary'],
            'has_active_timer' => $this->resource['has_active_timer'],
            'last_activity_at' => $this->resource['last_activity_at'],
            'manager_metrics' => $this->resource['manager_metrics'] ?? null,
        ];
    }
}
