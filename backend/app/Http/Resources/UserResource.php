<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $currentRole = $this->currentRole();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => ($currentRole ?? $this->role)->value,
            'organization_id' => $this->organization_id,
            'email_verified_at' => $this->email_verified_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
