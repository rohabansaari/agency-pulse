<?php

namespace App\Models;

use App\Enums\PayrollComponentType;
use App\Enums\PayrollComponentValueMode;
use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollComponent extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'name',
        'type',
        'value_mode',
        'value',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'type' => PayrollComponentType::class,
            'value_mode' => PayrollComponentValueMode::class,
            'value' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
