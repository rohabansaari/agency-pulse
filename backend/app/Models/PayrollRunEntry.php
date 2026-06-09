<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollRunEntry extends Model
{
    protected $fillable = [
        'payroll_run_id',
        'time_entry_id',
        'user_id',
        'entry_type',
        'duration_seconds',
        'hourly_rate_snapshot',
        'pay_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'duration_seconds' => 'integer',
            'hourly_rate_snapshot' => 'decimal:2',
            'pay_snapshot' => 'decimal:2',
        ];
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function timeEntry(): BelongsTo
    {
        return $this->belongsTo(TimeEntry::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
