<?php

use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1 Routes — AgencyPulse
|--------------------------------------------------------------------------
*/

Route::get('/health', [HealthController::class, 'show']);

Route::prefix('auth')->group(base_path('routes/api/v1/auth.php'));

Route::middleware(['auth:sanctum', 'super.admin'])->prefix('platform')->group(
    base_path('routes/api/v1/platform.php')
);

require base_path('routes/api/v1/tenant.php');
