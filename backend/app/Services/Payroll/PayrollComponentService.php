<?php

namespace App\Services\Payroll;

use App\Enums\PayrollComponentType;
use App\Enums\PayrollComponentValueMode;
use App\Models\PayrollComponent;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Collection;

class PayrollComponentService
{
    /**
     * @return Collection<int, PayrollComponent>
     */
    public function listForOrganization(): Collection
    {
        return PayrollComponent::query()
            ->where('organization_id', TenantContext::id())
            ->orderBy('type')
            ->orderBy('name')
            ->get();
    }

    public function create(User $actor, array $validated): PayrollComponent
    {
        return PayrollComponent::create([
            'organization_id' => TenantContext::id(),
            'name' => $validated['name'],
            'type' => $validated['type'],
            'value_mode' => $validated['value_mode'],
            'value' => $validated['value'],
            'is_active' => $validated['is_active'] ?? true,
        ]);
    }

    public function update(PayrollComponent $component, array $validated): PayrollComponent
    {
        $this->ensureInTenant($component);

        $component->update($validated);

        return $component->fresh();
    }

    public function delete(PayrollComponent $component): void
    {
        $this->ensureInTenant($component);
        $component->delete();
    }

    /**
     * @return array{deductions: float, increments: float}
     */
    public function totalsForGross(float $gross, ?int $organizationId = null): array
    {
        if ($gross <= 0) {
            return ['deductions' => 0.0, 'increments' => 0.0];
        }

        $organizationId ??= TenantContext::id();

        $components = PayrollComponent::query()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->get();

        $deductions = 0.0;
        $increments = 0.0;

        foreach ($components as $component) {
            $amount = $this->amountForComponent($gross, $component);

            if ($component->type === PayrollComponentType::Deduction) {
                $deductions += $amount;
            } else {
                $increments += $amount;
            }
        }

        return [
            'deductions' => round($deductions, 2),
            'increments' => round($increments, 2),
        ];
    }

    private function amountForComponent(float $gross, PayrollComponent $component): float
    {
        $value = (float) $component->value;

        if ($value <= 0) {
            return 0.0;
        }

        if ($component->value_mode === PayrollComponentValueMode::Percentage) {
            return round($gross * ($value / 100), 2);
        }

        return round($value, 2);
    }

    private function ensureInTenant(PayrollComponent $component): void
    {
        if ($component->organization_id !== TenantContext::id()) {
            abort(404);
        }
    }
}
