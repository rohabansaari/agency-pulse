<?php

use App\Http\Controllers\Api\V1\PayrollRunController;
use Illuminate\Support\Facades\Route;

Route::middleware(['rbac:admin', 'payroll.vault'])->group(function () {
    Route::get('/', [PayrollRunController::class, 'index']);
    Route::post('/', [PayrollRunController::class, 'store']);
    Route::get('/{payrollRun}', [PayrollRunController::class, 'show']);
    Route::patch('/{payrollRun}', [PayrollRunController::class, 'update']);
    Route::delete('/{payrollRun}', [PayrollRunController::class, 'destroy']);
    Route::post('/{payrollRun}/recalculate', [PayrollRunController::class, 'recalculate']);
    Route::post('/{payrollRun}/finalize', [PayrollRunController::class, 'finalize']);
    Route::post('/{payrollRun}/lock', [PayrollRunController::class, 'lock']);
});
