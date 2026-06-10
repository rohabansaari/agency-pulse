<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryChangeAudit extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'employee_id',
        'changed_by',
        'salary_type',
        'previous_salary_encrypted',
        'new_salary_encrypted',
        'effective_date',
    ];

    protected function casts(): array
    {
        return [
            'previous_salary_encrypted' => 'encrypted',
            'new_salary_encrypted' => 'encrypted',
            'effective_date' => 'date',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
