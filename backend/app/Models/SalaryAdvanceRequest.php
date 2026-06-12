<?php

namespace App\Models;

use App\Enums\AdvanceRequestStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryAdvanceRequest extends Model
{
    protected $fillable = [
        'organization_id',
        'user_id',
        'reviewed_by',
        'amount',
        'reason',
        'status',
        'reviewed_at',
        'deducted_at',
        'payroll_run_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'status' => AdvanceRequestStatus::class,
            'reviewed_at' => 'datetime',
            'deducted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }
}
