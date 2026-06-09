<?php



namespace App\Http\Resources;



use App\Enums\UserRole;

use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\JsonResource;



/** @mixin \App\Models\Project */

class ProjectResource extends JsonResource

{

    /**

     * @return array<string, mixed>

     */

    public function toArray(Request $request): array

    {

        $isAdmin = $request->user()?->currentRole() === UserRole::Admin;



        return [

            'id' => $this->id,

            'organization_id' => $this->organization_id,

            'name' => $this->name,

            'client_name' => $this->client_name,

            'description' => $this->description,

            'hourly_rate' => $this->when($isAdmin, $this->hourly_rate),

            'status' => $this->status->value,

            'members_count' => $this->whenCounted('members'),

            'total_tracked_seconds' => $this->when(isset($this->total_tracked_seconds), $this->total_tracked_seconds),

            'created_at' => $this->created_at,

            'updated_at' => $this->updated_at,

        ];

    }

}

