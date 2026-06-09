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
            'assigned_projects_count' => $this->when(
                isset($this->assigned_projects_count),
                $this->assigned_projects_count
            ),
        ];
    }
}
