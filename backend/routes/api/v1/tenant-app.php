<?php

use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/user', [UserController::class, 'show']);
Route::get('/dashboard', [DashboardController::class, 'show']);
Route::prefix('reports')->group(base_path('routes/api/v1/reports.php'));
Route::prefix('time')->group(base_path('routes/api/v1/time.php'));
Route::prefix('projects')->group(base_path('routes/api/v1/projects.php'));
Route::prefix('team')->group(base_path('routes/api/v1/team.php'));
Route::prefix('teams')->group(base_path('routes/api/v1/teams.php'));
Route::prefix('payroll-runs')->group(base_path('routes/api/v1/payroll.php'));
Route::prefix('payroll')->group(base_path('routes/api/v1/payroll-salary.php'));
Route::prefix('screenshots')->group(base_path('routes/api/v1/screenshots.php'));
Route::prefix('agent')->group(base_path('routes/api/v1/agent.php'));
Route::prefix('hr')->group(base_path('routes/api/v1/hr.php'));
