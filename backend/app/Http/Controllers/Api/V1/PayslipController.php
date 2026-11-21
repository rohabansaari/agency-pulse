<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Services\Payroll\PayslipService;
use App\Services\Tenant\TenantContext;
use App\Support\PayrollVaultState;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Payslips from finalized payroll. Employees see their own; an admin sees
 * anyone's with the payroll vault unlocked (X-Payroll-Pin).
 */
class PayslipController extends TenantAppController
{
    public function __construct(
        private readonly PayslipService $payslips,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->payslips->listForUser($request->user(), TenantContext::id()),
        ]);
    }

    public function show(Request $request, int $payslip): JsonResponse
    {
        $record = $this->payslips->findIssued($payslip, TenantContext::id());
        $user = $request->user();

        $allowed = $record && (
            $record->user_id === $user->id
            || ($user->currentRole() === UserRole::Admin && PayrollVaultState::isUnlocked($request))
        );

        // 404 either way, so ids of other people's payslips aren't confirmed.
        abort_unless($allowed, 404);

        return response()->json(['data' => $this->payslips->payslip($record)]);
    }
}
