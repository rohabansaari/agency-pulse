<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PayrollDeductionMode;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrganizationPayrollSettingsResource;
use App\Services\Payroll\PayrollSettingsService;
use App\Services\Payroll\PayrollVaultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PayrollSettingsController extends Controller
{
    public function __construct(
        private readonly PayrollSettingsService $payrollSettings,
        private readonly PayrollVaultService $payrollVault
    ) {}

    public function show(Request $request): JsonResponse
    {
        $settings = $this->payrollSettings->forOrganization();

        return (new OrganizationPayrollSettingsResource($settings))
            ->response()
            ->setStatusCode(200);
    }

    public function update(Request $request): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $validated = $request->validate([
            'working_days_per_month' => ['sometimes', 'integer', 'min:1', 'max:31'],
            'working_hours_per_day' => ['sometimes', 'integer', 'min:1', 'max:24'],
            'deduction_mode' => ['sometimes', Rule::enum(PayrollDeductionMode::class)],
            'income_tax_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'eobi_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'social_security_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'custom_deduction_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'overtime_enabled' => ['sometimes', 'boolean'],
            'overtime_rate_percentage' => ['sometimes', 'numeric', 'min:100', 'max:500'],
        ]);

        if (
            isset($validated['deduction_mode'])
            && $validated['deduction_mode'] === PayrollDeductionMode::FbrSlabs->value
        ) {
            return response()->json([
                'message' => 'Pakistan FBR tax slab mode is not available yet.',
                'errors' => [
                    'deduction_mode' => ['FBR slab mode will be enabled in a future release.'],
                ],
            ], 422);
        }

        $settings = $this->payrollSettings->update($request->user(), $validated);

        return response()->json([
            'message' => 'Payroll settings updated.',
            'settings' => new OrganizationPayrollSettingsResource($settings),
        ]);
    }
}
