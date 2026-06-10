<?php

use App\Http\Controllers\Api\V1\PlatformDashboardController;
use App\Http\Controllers\Api\V1\PlatformPasswordController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', [PlatformDashboardController::class, 'show']);
Route::patch('/password', [PlatformPasswordController::class, 'update']);
