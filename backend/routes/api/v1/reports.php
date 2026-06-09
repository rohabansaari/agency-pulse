<?php



use App\Http\Controllers\Api\V1\ReportController;

use Illuminate\Support\Facades\Route;



Route::middleware('rbac:admin')->get('/organization', [ReportController::class, 'organization']);

Route::middleware('rbac:manager')->get('/manager', [ReportController::class, 'manager']);

Route::middleware('rbac:admin,manager')->get('/projects/{project}', [ReportController::class, 'project']);

