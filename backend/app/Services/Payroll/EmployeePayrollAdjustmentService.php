<?php

namespace App\Services\Payroll;

use App\Enums\PayrollComponentType;
use App\Enums\PayrollComponentValueMode;
use App\Models\EmployeePayrollAdjustment;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class EmployeePayrollAdjustmentService
{
    /**
     * @return Collection<int, EmployeePayrollAdjustment>
     */
    public function listForUser(int $userId): Collection
    {
        return EmployeePayrollAdjustment::query()
            ->where('organization_id', TenantContext::id())
            ->where('user_id', $userId)
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();
    }

    public function create(User $actor, int $userId, array $validated): EmployeePayrollAdjustment
    {
        return EmployeePayrollAdjustment::create([
            'organization_id' => TenantContext::id(),
            'user_id' => $userId,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'value_mode' => $validated['value_mode'],
            'value' => $validated['value'],
            'effective_month' => $validated['effective_month'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);
    }

    public function update(EmployeePayrollAdjustment $adjustment, array $validated): EmployeePayrollAdjustment
    {
        $this->ensureInTenant($adjustment);
        $adjustment->update($validated);

        return $adjustment->fresh();
    }

    public function delete(EmployeePayrollAdjustment $adjustment): void
    {
        $this->ensureInTenant($adjustment);
        $adjustment->delete();
    }

    /**
     * @return array{
     *     deductions: float,
     *     increments: float,
     *     lines: list<array{name: string, type: string, amount: float, source: string}>
     * }
     */
    public function totalsForGross(
        int $userId,
        float $gross,
        Carbon $periodStart,
        Carbon $periodEnd,
        ?int $organizationId = null
    ): array {
        if ($gross <= 0) {
            return ['deductions' => 0.0, 'increments' => 0.0, 'lines' => []];
        }

        $organizationId ??= TenantContext::id();

        $adjustments = EmployeePayrollAdjustment::query()
            ->where('organization_id', $organizationId)
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->get();

        $deductions = 0.0;
        $increments = 0.0;
        $lines = [];

        foreach ($adjustments as $adjustment) {
            if (! $this->appliesInPeriod($adjustment, $periodStart, $periodEnd)) {
                continue;
            }

            $amount = $this->amountForAdjustment($gross, $adjustment);

            if ($adjustment->type === PayrollComponentType::Deduction) {
                $deductions += $amount;
            } else {
                $increments += $amount;
            }

            $lines[] = [
                'name' => $adjustment->name,
                'type' => $adjustment->type->value,
                'amount' => round($amount, 2),
                'source' => 'employee',
            ];
        }

        return [
            'deductions' => round($deductions, 2),
            'increments' => round($increments, 2),
            'lines' => $lines,
        ];
    }

    private function appliesInPeriod(
        EmployeePayrollAdjustment $adjustment,
        Carbon $periodStart,
        Carbon $periodEnd
    ): bool {
        if ($adjustment->effective_month === null) {
            return true;
        }

        $effective = Carbon::parse($adjustment->effective_month)->startOfMonth();

        return $effective->lte($periodEnd->copy()->endOfMonth())
            && $effective->gte($periodStart->copy()->startOfMonth());
    }

    private function amountForAdjustment(float $gross, EmployeePayrollAdjustment $adjustment): float
    {
        $value = (float) $adjustment->value;

        if ($value <= 0) {
            return 0.0;
        }

        if ($adjustment->value_mode === PayrollComponentValueMode::Percentage) {
            return round($gross * ($value / 100), 2);
        }

        return round($value, 2);
    }

    private function ensureInTenant(EmployeePayrollAdjustment $adjustment): void
    {
        if ($adjustment->organization_id !== TenantContext::id()) {
            abort(404);
        }
    }
}
