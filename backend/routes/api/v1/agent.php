<?php

use App\Http\Controllers\Api\V1\ScreenshotController;
use Illuminate\Support\Facades\Route;

Route::post('/heartbeat', [ScreenshotController::class, 'heartbeat'])
    ->middleware('permission:screenshots.upload')
    ->name('agent.heartbeat');
