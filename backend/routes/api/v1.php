<?php

use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1 Routes — AgencyPulse
|--------------------------------------------------------------------------
*/

Route::get('/health', [HealthController::class, 'show']);

if (app()->environment(['local', 'testing'])) {
    Route::post('/testing/activate-invited-user', [
        \App\Http\Controllers\Api\V1\E2eTestingController::class,
        'activateInvitedUser',
    ]);
}

Route::prefix('auth')->group(base_path('routes/api/v1/auth.php'));

Route::middleware(['auth:sanctum', 'super.admin'])->prefix('platform')->group(
    base_path('routes/api/v1/platform.php')
);

Route::middleware(['auth:sanctum', 'block.super.admin', 'tenant', 'idempotency'])->group(
    base_path('routes/api/v1/tenant.php')
);
