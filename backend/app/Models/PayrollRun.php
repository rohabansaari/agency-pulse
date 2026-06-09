<?php

namespace App\Models;

use App\Enums\PayrollRunStatus;
use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'period_start',
        'period_end',
        'status',
        'total_hours_snapshot',
        'total_pay_snapshot',
        'total_net_snapshot',
        'created_by',
        'finalized_by',
        'finalized_at',
        'locked_by',
        'locked_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'status' => PayrollRunStatus::class,
            'total_hours_snapshot' => 'integer',
            'total_pay_snapshot' => 'decimal:2',
            'total_net_snapshot' => 'decimal:2',
            'finalized_at' => 'datetime',
            'locked_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function finalizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }

    public function locker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(PayrollRunEntry::class);
    }

    public function employeeRecords(): HasMany
    {
        return $this->hasMany(PayrollRunEmployeeRecord::class);
    }
}
