<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;

class InsightSummary extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'scope',
        'period_start',
        'period_end',
        'summary',
        'model',
        'generated_by',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'summary' => 'array',
        ];
    }
}
