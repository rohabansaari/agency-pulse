<?php

use App\Http\Controllers\Api\V1\EmployeePayrollAdjustmentController;
use App\Http\Controllers\Api\V1\LeaveBalanceController;
use App\Http\Controllers\Api\V1\SalaryAdvanceController;
use Illuminate\Support\Facades\Route;

Route::middleware('rbac:employee,manager')->group(function () {
    Route::get('/advances', [SalaryAdvanceController::class, 'index']);
    Route::post('/advances', [SalaryAdvanceController::class, 'store']);
});

Route::middleware('rbac:admin')->group(function () {
    Route::get('/advances/pending', [SalaryAdvanceController::class, 'pending']);
    Route::post('/advances/{advanceRequest}/approve', [SalaryAdvanceController::class, 'approve']);
    Route::post('/advances/{advanceRequest}/reject', [SalaryAdvanceController::class, 'reject']);
});

Route::middleware('rbac:employee,manager')->get('/leave-balance', [LeaveBalanceController::class, 'mine']);

Route::middleware('rbac:admin,sub_admin')->group(function () {
    Route::get('/leave-balances', [LeaveBalanceController::class, 'index']);
    Route::patch('/leave-balances/{user}', [LeaveBalanceController::class, 'updateLimit']);
    Route::post('/leave-balances/{user}/reset', [LeaveBalanceController::class, 'reset']);
});

Route::middleware('rbac:admin,sub_admin,manager,employee')->get(
    '/payroll-adjustments/{user}',
    [EmployeePayrollAdjustmentController::class, 'index']
);
