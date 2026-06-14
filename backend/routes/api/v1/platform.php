<?php

use App\Http\Controllers\Api\V1\PlatformDashboardController;
use App\Http\Controllers\Api\V1\PlatformMailController;
use App\Http\Controllers\Api\V1\PlatformOrganizationController;
use App\Http\Controllers\Api\V1\PlatformPasswordController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', [PlatformDashboardController::class, 'show']);
Route::get('/mail/status', [PlatformMailController::class, 'status']);
Route::post('/mail/test', [PlatformMailController::class, 'test']);
Route::get('/organizations', [PlatformOrganizationController::class, 'index']);
Route::post('/organizations', [PlatformOrganizationController::class, 'store']);
Route::post('/organizations/{organization}/resend-admin-invitation', [PlatformOrganizationController::class, 'resendAdminInvitation']);
Route::patch('/organizations/{organization}', [PlatformOrganizationController::class, 'update']);
Route::delete('/organizations/{organization}', [PlatformOrganizationController::class, 'destroy']);
Route::patch('/password', [PlatformPasswordController::class, 'update']);
