<?php

use App\Http\Controllers\Api\V1\EmployeePayrollAdjustmentController;
use App\Http\Controllers\Api\V1\PayrollComponentController;
use App\Http\Controllers\Api\V1\PayrollSettingsController;
use App\Http\Controllers\Api\V1\PayrollVaultController;
use App\Http\Controllers\Api\V1\SalaryContractController;
use Illuminate\Support\Facades\Route;

Route::middleware('rbac:admin')->group(function () {
    // vault/status lives in payroll-vault.php (accessible during onboarding too)
    Route::post('/vault/change-pin', [PayrollVaultController::class, 'changePin']);
});

Route::middleware(['rbac:admin', 'payroll.vault'])->group(function () {
    Route::post('/vault/unlock', [PayrollVaultController::class, 'unlock']);
    Route::post('/vault/lock', [PayrollVaultController::class, 'lock']);

    Route::get('/settings', [PayrollSettingsController::class, 'show']);
    Route::patch('/settings', [PayrollSettingsController::class, 'update']);

    Route::get('/components', [PayrollComponentController::class, 'index']);
    Route::post('/components', [PayrollComponentController::class, 'store']);
    Route::patch('/components/{component}', [PayrollComponentController::class, 'update']);
    Route::delete('/components/{component}', [PayrollComponentController::class, 'destroy']);

    Route::get('/salary-contracts/{user}/status', [SalaryContractController::class, 'status']);
    Route::post('/salary-contracts/{user}', [SalaryContractController::class, 'store']);

    Route::get('/adjustments/{user}', [EmployeePayrollAdjustmentController::class, 'index']);
    Route::post('/adjustments/{user}', [EmployeePayrollAdjustmentController::class, 'store']);
    Route::patch('/adjustments/{adjustment}', [EmployeePayrollAdjustmentController::class, 'update']);
    Route::delete('/adjustments/{adjustment}', [EmployeePayrollAdjustmentController::class, 'destroy']);
});
