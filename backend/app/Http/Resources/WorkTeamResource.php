<?php



namespace App\Http\Resources;



use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\JsonResource;



/** @mixin \App\Models\Team */

class WorkTeamResource extends JsonResource

{

    /**

     * @return array<string, mixed>

     */

    public function toArray(Request $request): array

    {

        return [

            'id' => $this->id,

            'name' => $this->name,

            'manager_id' => $this->manager_id,

            'manager_name' => $this->whenLoaded('manager', fn () => $this->manager?->name),

            'manager_email' => $this->whenLoaded('manager', fn () => $this->manager?->email),

            'members_count' => $this->when(

                isset($this->members_count),

                $this->members_count

            ),

            'members' => WorkTeamMemberResource::collection(

                $this->whenLoaded('members')

            ),

            'active_projects_count' => $this->when(

                isset($this->active_projects_count),

                $this->active_projects_count

            ),

            'team_hours_today_seconds' => $this->when(

                isset($this->team_hours_today_seconds),

                $this->team_hours_today_seconds

            ),

            'created_at' => $this->created_at,

        ];

    }

}

