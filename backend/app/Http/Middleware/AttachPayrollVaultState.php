<?php

namespace App\Http\Middleware;

use App\Services\Payroll\PayrollVaultService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AttachPayrollVaultState
{
    public function __construct(
        private readonly PayrollVaultService $payrollVault
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $unlocked = $user ? $this->payrollVault->isUnlocked($user) : false;

        $request->attributes->set('payroll_vault_unlocked', $unlocked);

        return $next($request);
    }
}
