<?php

namespace App\Support;

use Illuminate\Http\Request;

final class PayrollVaultState
{
    public static function isUnlocked(Request $request): bool
    {
        return (bool) $request->attributes->get('payroll_vault_unlocked', false);
    }
}
