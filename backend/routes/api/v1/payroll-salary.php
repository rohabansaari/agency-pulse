<?php

use App\Http\Controllers\Api\V1\PayrollSettingsController;
use App\Http\Controllers\Api\V1\PayrollVaultController;
use App\Http\Controllers\Api\V1\SalaryContractController;
use Illuminate\Support\Facades\Route;

Route::middleware(['rbac:admin', 'payroll.vault'])->group(function () {
    Route::get('/vault/status', [PayrollVaultController::class, 'status']);
    Route::post('/vault/initialize', [PayrollVaultController::class, 'initialize']);
    Route::post('/vault/unlock', [PayrollVaultController::class, 'unlock']);
    Route::post('/vault/lock', [PayrollVaultController::class, 'lock']);
    Route::post('/vault/change-pin', [PayrollVaultController::class, 'changePin']);

    Route::get('/settings', [PayrollSettingsController::class, 'show']);
    Route::patch('/settings', [PayrollSettingsController::class, 'update']);

    Route::get('/salary-contracts', [SalaryContractController::class, 'index']);
    Route::get('/salary-contracts/{user}', [SalaryContractController::class, 'history']);
    Route::post('/salary-contracts/{user}', [SalaryContractController::class, 'store']);
});
