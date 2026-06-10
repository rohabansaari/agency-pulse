<?php

namespace App\Models;

use App\Enums\TimeEntryStatus;
use App\Enums\UserRole;
use App\Services\Tenant\TenantContext;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    protected string $guard_name = 'sanctum';

    protected $fillable = [
        'organization_id',
        'name',
        'email',
        'password',
        'role',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
        ];
    }

    public function currentRole(): ?UserRole
    {
        if ($this->isSuperAdmin()) {
            return UserRole::SuperAdmin;
        }

        if (TenantContext::has()) {
            $membership = $this->membershipFor(TenantContext::id());

            return $membership?->role;
        }

        return $this->role;
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SuperAdmin && $this->organization_id === null;
    }

    public function isAdmin(): bool
    {
        return $this->currentRole() === UserRole::Admin;
    }

    public function isManager(): bool
    {
        return $this->currentRole() === UserRole::Manager;
    }

    public function isEmployee(): bool
    {
        return $this->currentRole() === UserRole::Employee;
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function salaryContracts(): HasMany
    {
        return $this->hasMany(EmployeeSalaryContract::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(OrganizationMember::class);
    }

    public function membershipFor(int $organizationId): ?OrganizationMember
    {
        return $this->memberships()
            ->where('organization_id', $organizationId)
            ->first();
    }

    public function belongsToOrganization(int $organizationId): bool
    {
        return $this->memberships()
            ->where('organization_id', $organizationId)
            ->where('status', 'active')
            ->exists();
    }

    public function assignedProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_assignments')
            ->withPivot('role_in_project')
            ->withTimestamps();
    }

    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    public function managedTeams(): HasMany
    {
        return $this->hasMany(Team::class, 'manager_id');
    }

    public function workTeam(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_members')
            ->withTimestamps();
    }

    public function workTeamMembership(): ?TeamMember
    {
        return TeamMember::query()->where('user_id', $this->id)->first();
    }

    public function activeTimeEntry(): ?TimeEntry
    {
        return $this->timeEntries()
            ->where('status', TimeEntryStatus::Running)
            ->first();
    }
}
