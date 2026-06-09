<?php



namespace App\Http\Resources;



use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\JsonResource;



/** @mixin \App\Models\User */

class WorkTeamMemberResource extends JsonResource

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

            'role' => $this->when(

                isset($this->membership_role),

                $this->membership_role

            ),

        ];

    }

}

