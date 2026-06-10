<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Services\Payroll\PayrollVaultService;
use App\Services\Tenant\TenantContext;
use Illuminate\Http\Request;

class PayrollVaultState
{
    public static function isUnlocked(Request $request): bool
    {
        $user = $request->user();

        if (! $user || $user->currentRole() !== UserRole::Admin) {
            return false;
        }

        $pin = $request->header('X-Payroll-Pin');

        if (! is_string($pin) || $pin === '') {
            return false;
        }

        return app(PayrollVaultService::class)->validatePin(TenantContext::get(), $pin);
    }
}
