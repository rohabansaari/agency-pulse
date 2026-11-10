<?php

namespace App\Models;

use App\Enums\InvoiceLineKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceLine extends Model
{
    protected $fillable = [
        'invoice_id',
        'project_id',
        'kind',
        'description',
        'quantity',
        'unit_price',
        'amount',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'kind' => InvoiceLineKind::class,
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'amount' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
