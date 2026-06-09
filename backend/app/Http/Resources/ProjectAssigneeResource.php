<?php



namespace App\Http\Resources;



use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\JsonResource;



/** @mixin \App\Models\User */

class ProjectAssigneeResource extends JsonResource

{

    /**

     * @return array<string, mixed>

     */

    public function toArray(Request $request): array

    {

        return [

            'id' => $this->id,

            'name' => $this->name,

            'email' => $this->email,

            'role_in_project' => $this->when(

                isset($this->pivot),

                fn () => $this->pivot->role_in_project

            ),

            'assigned_at' => $this->when(isset($this->pivot), $this->pivot?->created_at),

        ];

    }

}

