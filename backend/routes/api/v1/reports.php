<?php



use App\Http\Controllers\Api\V1\ReportController;

use Illuminate\Support\Facades\Route;



Route::middleware('rbac:admin,sub_admin')->get('/organization', [ReportController::class, 'organization']);

Route::middleware('rbac:manager')->get('/manager', [ReportController::class, 'manager']);

// Revenue, salary cost and margin. Salary data, so admin + payroll PIN only.
Route::middleware(['rbac:admin', 'payroll.vault'])->get('/profitability', [ReportController::class, 'profitability']);

Route::middleware('rbac:admin,sub_admin,manager')->get('/projects/{project}', [ReportController::class, 'project']);

