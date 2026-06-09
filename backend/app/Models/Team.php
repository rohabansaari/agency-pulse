<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class Team extends Model
{
    /** @use HasFactory<\Database\Factories\TeamFactory> */
    use BelongsToOrganization, HasFactory;

    protected $fillable = [
        'organization_id',
        'name',
        'manager_id',
    ];

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(TeamMember::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_members')
            ->withTimestamps();
    }

    /**
     * @return Collection<int, int>
     */
    public function participantUserIds(): Collection
    {
        $this->loadMissing('members');

        $ids = $this->members->pluck('id');

        if ($this->manager_id) {
            $ids = $ids->push($this->manager_id);
        }

        return $ids->unique()->values();
    }

    /**
     * @return Collection<int, User>
     */
    public function participants(): Collection
    {
        $this->loadMissing(['members', 'manager']);

        $users = $this->members;

        if ($this->manager && ! $users->contains('id', $this->manager->id)) {
            $users = $users->push($this->manager);
        }

        return $users->sortBy('name')->values();
    }
}
