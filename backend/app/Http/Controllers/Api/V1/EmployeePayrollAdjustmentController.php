<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PayrollComponentType;
use App\Enums\PayrollComponentValueMode;
use App\Http\Controllers\Controller;
use App\Http\Resources\EmployeePayrollAdjustmentResource;
use App\Models\EmployeePayrollAdjustment;
use App\Models\User;
use App\Enums\UserRole;
use App\Services\Payroll\EmployeePayrollAdjustmentService;
use App\Services\Payroll\PayrollVaultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class EmployeePayrollAdjustmentController extends Controller
{
    public function __construct(
        private readonly EmployeePayrollAdjustmentService $adjustments,
        private readonly PayrollVaultService $payrollVault
    ) {}

    public function index(Request $request, User $user): AnonymousResourceCollection
    {
        $this->assertCanView($request->user(), $user);

        return EmployeePayrollAdjustmentResource::collection(
            $this->adjustments->listForUser($user->id)
        );
    }

    public function store(Request $request, User $user): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::enum(PayrollComponentType::class)],
            'value_mode' => ['required', Rule::enum(PayrollComponentValueMode::class)],
            'value' => ['required', 'numeric', 'min:0'],
            'effective_month' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (
            $validated['value_mode'] === PayrollComponentValueMode::Percentage->value
            && (float) $validated['value'] > 100
        ) {
            return response()->json([
                'message' => 'Percentage value cannot exceed 100.',
                'errors' => ['value' => ['Percentage value cannot exceed 100.']],
            ], 422);
        }

        $adjustment = $this->adjustments->create($request->user(), $user->id, $validated);

        return response()->json([
            'message' => 'Payroll adjustment created.',
            'adjustment' => new EmployeePayrollAdjustmentResource($adjustment),
        ], 201);
    }

    public function update(Request $request, EmployeePayrollAdjustment $adjustment): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'type' => ['sometimes', Rule::enum(PayrollComponentType::class)],
            'value_mode' => ['sometimes', Rule::enum(PayrollComponentValueMode::class)],
            'value' => ['sometimes', 'numeric', 'min:0'],
            'effective_month' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $valueMode = $validated['value_mode'] ?? $adjustment->value_mode->value;
        $value = $validated['value'] ?? $adjustment->value;

        if (
            $valueMode === PayrollComponentValueMode::Percentage->value
            && (float) $value > 100
        ) {
            return response()->json([
                'message' => 'Percentage value cannot exceed 100.',
                'errors' => ['value' => ['Percentage value cannot exceed 100.']],
            ], 422);
        }

        $updated = $this->adjustments->update($adjustment, $validated);

        return response()->json([
            'message' => 'Payroll adjustment updated.',
            'adjustment' => new EmployeePayrollAdjustmentResource($updated),
        ]);
    }

    public function destroy(Request $request, EmployeePayrollAdjustment $adjustment): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());
        $this->adjustments->delete($adjustment);

        return response()->json(['message' => 'Payroll adjustment deleted.']);
    }

    private function assertCanView(User $actor, User $target): void
    {
        $role = $actor->currentRole();

        if ($role?->isOperationalAdmin()) {
            return;
        }

        if ($actor->id === $target->id) {
            return;
        }

        if ($role === UserRole::Manager) {
            return;
        }

        abort(403, 'You cannot view payroll adjustments for this employee.');
    }
}
