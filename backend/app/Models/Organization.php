<?php

namespace App\Models;

use App\Enums\OrganizationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Organization extends Model
{
    /** @use HasFactory<\Database\Factories\OrganizationFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'status',
        'onboarding_completed',
        'onboarding_step',
        'timezone',
        'logo_url',
        'website',
        'payroll_pin',
        'payroll_pin_created_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => OrganizationStatus::class,
            'onboarding_completed' => 'boolean',
            'onboarding_step' => 'integer',
            'payroll_pin' => 'encrypted',
            'payroll_pin_created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Organization $organization): void {
            if ($organization->slug) {
                return;
            }

            $baseSlug = Str::slug($organization->name) ?: 'organization';
            $slug = $baseSlug;
            $suffix = 1;

            while (static::query()->where('slug', $slug)->exists()) {
                $slug = $baseSlug.'-'.$suffix;
                $suffix++;
            }

            $organization->slug = $slug;
        });
    }

    public function members(): HasMany
    {
        return $this->hasMany(OrganizationMember::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }
}
