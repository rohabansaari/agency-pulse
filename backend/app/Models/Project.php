<?php

namespace App\Models;

use App\Enums\ProjectBillingType;
use App\Enums\ProjectStatus;
use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    /** @use HasFactory<\Database\Factories\ProjectFactory> */
    use BelongsToOrganization, HasFactory;

    protected $fillable = [
        'organization_id',
        'name',
        'client_name',
        'description',
        'hourly_rate',
        'billing_type',
        'budget_hours',
        'budget_amount',
        'starts_on',
        'due_on',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'hourly_rate' => 'decimal:2',
            'billing_type' => ProjectBillingType::class,
            'budget_hours' => 'decimal:2',
            'budget_amount' => 'decimal:2',
            'starts_on' => 'date',
            'due_on' => 'date',
            'status' => ProjectStatus::class,
        ];
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_assignments')
            ->withPivot('role_in_project')
            ->withTimestamps();
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ProjectAssignment::class);
    }

    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    public function billingType(): ProjectBillingType
    {
        return $this->billing_type ?? ProjectBillingType::Hourly;
    }

    public function isArchived(): bool
    {
        return $this->status === ProjectStatus::Archived;
    }
}
