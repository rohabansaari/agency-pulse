<?php

use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1 Routes — AgencyPulse
|--------------------------------------------------------------------------
*/

Route::get('/health', [HealthController::class, 'show']);

Route::prefix('auth')->group(base_path('routes/api/v1/auth.php'));

Route::middleware(['auth:sanctum', 'tenant', 'idempotency'])->group(function () {
    Route::get('/user', [UserController::class, 'show']);
    Route::get('/dashboard', [DashboardController::class, 'show']);
    Route::prefix('reports')->group(base_path('routes/api/v1/reports.php'));

    Route::prefix('time')->group(base_path('routes/api/v1/time.php'));
    Route::prefix('projects')->group(base_path('routes/api/v1/projects.php'));
    Route::prefix('team')->group(base_path('routes/api/v1/team.php'));
    Route::prefix('teams')->group(base_path('routes/api/v1/teams.php'));
    Route::prefix('payroll-runs')->group(base_path('routes/api/v1/payroll.php'));
    Route::prefix('payroll')->group(base_path('routes/api/v1/payroll-salary.php'));
});
