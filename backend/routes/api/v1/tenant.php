<?php

use Illuminate\Support\Facades\Route;

Route::middleware('rbac:admin')->prefix('onboarding')->group(
    base_path('routes/api/v1/onboarding.php')
);

Route::middleware('rbac:admin')->prefix('payroll')->group(
    base_path('routes/api/v1/payroll-vault.php')
);

Route::middleware('onboarding.complete')->group(
    base_path('routes/api/v1/tenant-app.php')
);
