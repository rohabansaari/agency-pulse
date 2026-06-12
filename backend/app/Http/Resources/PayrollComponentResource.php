<?php

namespace App\Http\Resources;

use App\Support\PayrollVaultState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PayrollComponent */
class PayrollComponentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $unlocked = PayrollVaultState::isUnlocked($request);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type->value,
            'value_mode' => $this->value_mode->value,
            'value' => $unlocked ? $this->value : null,
            'is_active' => $this->is_active,
            'financial_data_masked' => ! $unlocked,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
