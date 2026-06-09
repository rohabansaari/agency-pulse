<?php



namespace App\Models;



use App\Enums\ProjectAssignmentRole;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Relations\BelongsTo;



class ProjectAssignment extends Model

{

    protected $fillable = [

        'project_id',

        'user_id',

        'role_in_project',

    ];



    protected function casts(): array

    {

        return [

            'role_in_project' => ProjectAssignmentRole::class,

        ];

    }



    public function project(): BelongsTo

    {

        return $this->belongsTo(Project::class);

    }



    public function user(): BelongsTo

    {

        return $this->belongsTo(User::class);

    }

}

