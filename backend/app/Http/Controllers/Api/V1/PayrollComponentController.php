<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PayrollComponentType;
use App\Enums\PayrollComponentValueMode;
use App\Http\Controllers\Controller;
use App\Http\Resources\PayrollComponentResource;
use App\Models\PayrollComponent;
use App\Services\Payroll\PayrollComponentService;
use App\Services\Payroll\PayrollVaultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PayrollComponentController extends TenantAppController
{
    public function __construct(
        private readonly PayrollComponentService $components,
        private readonly PayrollVaultService $payrollVault
    ) {}

    public function index(): AnonymousResourceCollection
    {
        return PayrollComponentResource::collection(
            $this->components->listForOrganization()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::enum(PayrollComponentType::class)],
            'value_mode' => ['required', Rule::enum(PayrollComponentValueMode::class)],
            'value' => ['required', 'numeric', 'min:0'],
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

        $component = $this->components->create($request->user(), $validated);

        return response()->json([
            'message' => 'Payroll component created.',
            'component' => new PayrollComponentResource($component),
        ], 201);
    }

    public function update(Request $request, PayrollComponent $component): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'type' => ['sometimes', Rule::enum(PayrollComponentType::class)],
            'value_mode' => ['sometimes', Rule::enum(PayrollComponentValueMode::class)],
            'value' => ['sometimes', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $valueMode = $validated['value_mode'] ?? $component->value_mode->value;
        $value = $validated['value'] ?? $component->value;

        if (
            $valueMode === PayrollComponentValueMode::Percentage->value
            && (float) $value > 100
        ) {
            return response()->json([
                'message' => 'Percentage value cannot exceed 100.',
                'errors' => ['value' => ['Percentage value cannot exceed 100.']],
            ], 422);
        }

        $updated = $this->components->update($component, $validated);

        return response()->json([
            'message' => 'Payroll component updated.',
            'component' => new PayrollComponentResource($updated),
        ]);
    }

    public function destroy(Request $request, PayrollComponent $component): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());
        $this->components->delete($component);

        return response()->json([
            'message' => 'Payroll component deleted.',
        ]);
    }
}
