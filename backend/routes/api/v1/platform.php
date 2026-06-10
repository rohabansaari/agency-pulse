<?php

use App\Http\Controllers\Api\V1\PlatformDashboardController;
use App\Http\Controllers\Api\V1\PlatformOrganizationController;
use App\Http\Controllers\Api\V1\PlatformPasswordController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', [PlatformDashboardController::class, 'show']);
Route::get('/organizations', [PlatformOrganizationController::class, 'index']);
Route::post('/organizations', [PlatformOrganizationController::class, 'store']);
Route::patch('/organizations/{organization}', [PlatformOrganizationController::class, 'update']);
Route::delete('/organizations/{organization}', [PlatformOrganizationController::class, 'destroy']);
Route::patch('/password', [PlatformPasswordController::class, 'update']);
