<?php

namespace App\Models;

use App\Enums\TimeEntrySource;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeEntry extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'user_id',
        'organization_id',
        'type',
        'project_id',
        'team_id',
        'manager_id',
        'start_time',
        'end_time',
        'duration',
        'description',
        'is_paid',
        'source',
        'status',
        'approved_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => TimeEntryType::class,
            'source' => TimeEntrySource::class,
            'is_paid' => 'boolean',
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'duration' => 'integer',
            'status' => TimeEntryStatus::class,
            'approved_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function assignedManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function isRunning(): bool
    {
        return $this->type === TimeEntryType::Tracked
            && $this->status === TimeEntryStatus::Running;
    }

    public function countsTowardTotals(): bool
    {
        return ($this->type === TimeEntryType::Tracked && $this->status === TimeEntryStatus::Stopped)
            || ($this->type === TimeEntryType::Manual && $this->status === TimeEntryStatus::Approved)
            || ($this->type === TimeEntryType::Leave
                && $this->status === TimeEntryStatus::Approved
                && $this->is_paid);
    }

    /**
     * Entries that contribute to reports and payroll totals.
     *
     * @param  Builder<TimeEntry>  $query
     */
    public function scopeCountable(Builder $query): Builder
    {
        return $query->where(function (Builder $q) {
            $q->where(function (Builder $inner) {
                $inner->where('type', TimeEntryType::Tracked)
                    ->where('status', TimeEntryStatus::Stopped);
            })->orWhere(function (Builder $inner) {
                $inner->where('type', TimeEntryType::Manual)
                    ->where('status', TimeEntryStatus::Approved);
            })->orWhere(function (Builder $inner) {
                $inner->where('type', TimeEntryType::Leave)
                    ->where('status', TimeEntryStatus::Approved)
                    ->where('is_paid', true);
            });
        });
    }

    /**
     * @param  Builder<TimeEntry>  $query
     */
    public function scopeTrackedTimers(Builder $query): Builder
    {
        return $query->where('type', TimeEntryType::Tracked);
    }

    /**
     * @param  Builder<TimeEntry>  $query
     */
    public function scopeManualEntries(Builder $query): Builder
    {
        return $query->where('type', TimeEntryType::Manual);
    }

    /**
     * @param  Builder<TimeEntry>  $query
     */
    public function scopeLeaveEntries(Builder $query): Builder
    {
        return $query->where('type', TimeEntryType::Leave);
    }
}
