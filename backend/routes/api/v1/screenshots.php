<?php

use App\Http\Controllers\Api\V1\ScreenshotController;
use Illuminate\Support\Facades\Route;

Route::post('/', [ScreenshotController::class, 'store'])
    ->middleware([
        'permission:screenshots.upload',
        'throttle:'.config('screenshots.rate_limit_per_minute', 10).',1',
    ])
    ->name('screenshots.store');

Route::post('/agent-heartbeat', [ScreenshotController::class, 'heartbeat'])
    ->middleware('permission:screenshots.upload')
    ->name('screenshots.agent-heartbeat');

Route::get('/agent-status', [ScreenshotController::class, 'agentStatus'])
    ->middleware('permission:screenshots.upload')
    ->name('screenshots.agent-status');

Route::get('/', [ScreenshotController::class, 'index'])
    ->middleware('role_or_permission:screenshots.view|screenshots.view_all')
    ->name('screenshots.index');
