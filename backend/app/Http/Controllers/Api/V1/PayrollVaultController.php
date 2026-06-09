<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Payroll\PayrollVaultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
class PayrollVaultController extends Controller
{
    public function __construct(
        private readonly PayrollVaultService $payrollVault
    ) {}

    public function status(Request $request): JsonResponse
    {
        return response()->json($this->payrollVault->status($request->user()));
    }

    public function initialize(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payroll_pin' => ['required', 'string', 'regex:/^\d{4,8}$/', 'confirmed'],
        ]);

        $this->payrollVault->initializePin($request->user(), $validated['payroll_pin']);

        return response()->json([
            'message' => 'Organization payroll PIN configured.',
            'status' => $this->payrollVault->status($request->user()),
        ], 201);
    }

    public function unlock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payroll_pin' => ['required', 'string', 'regex:/^\d{4,8}$/'],
        ]);

        $result = $this->payrollVault->unlock($request->user(), $validated['payroll_pin']);

        return response()->json([
            'message' => 'Payroll vault unlocked.',
            ...$result,
            'status' => $this->payrollVault->status($request->user()),
        ]);
    }

    public function lock(Request $request): JsonResponse
    {
        $this->payrollVault->lock($request->user());

        return response()->json([
            'message' => 'Payroll vault locked.',
            'status' => $this->payrollVault->status($request->user()),
        ]);
    }

    public function changePin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_pin' => ['required', 'string', 'regex:/^\d{4,8}$/'],
            'payroll_pin' => ['required', 'string', 'regex:/^\d{4,8}$/', 'confirmed'],
        ]);

        $this->payrollVault->changePin(
            $request->user(),
            $validated['current_pin'],
            $validated['payroll_pin']
        );

        return response()->json([
            'message' => 'Payroll PIN updated. Vault has been locked.',
            'status' => $this->payrollVault->status($request->user()),
        ]);
    }
}
