<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SalaryType;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Payroll\AdminPayrollService;
use App\Services\Payroll\PayrollVaultService;
use App\Support\DisplayDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SalaryContractController extends TenantAppController
{
    public function __construct(
        private readonly AdminPayrollService $adminPayroll,
        private readonly PayrollVaultService $payrollVault
    ) {}

    public function status(User $user): JsonResponse
    {
        return response()->json($this->adminPayroll->contractStatusForUser($user));
    }

    public function store(Request $request, User $user): JsonResponse
    {
        $this->payrollVault->assertUnlocked($request->user());

        $validated = $request->validate([
            'salary_type' => ['required', Rule::enum(SalaryType::class)],
            'hourly_rate' => ['required_if:salary_type,hourly', 'nullable', 'numeric', 'min:0'],
            'monthly_salary' => ['required_if:salary_type,monthly', 'nullable', 'numeric', 'min:0'],
            'effective_from' => ['sometimes', 'regex:'.DisplayDate::INPUT_PATTERN],
        ]);

        if (isset($validated['effective_from'])) {
            $validated['effective_from'] = DisplayDate::parse($validated['effective_from'], 'effective_from')->toDateString();
        }

        $contract = $this->adminPayroll->versionContract($request->user(), $user, $validated);

        return response()->json([
            'message' => 'Salary contract saved. Compensation values are encrypted and not displayed.',
            'contract' => $this->adminPayroll->publicContractPayload($contract),
        ], 201);
    }
}
