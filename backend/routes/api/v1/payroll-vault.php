<?php

use App\Http\Controllers\Api\V1\PayrollVaultController;
use Illuminate\Support\Facades\Route;

Route::get('/vault/status', [PayrollVaultController::class, 'status']);
Route::post('/vault/initialize', [PayrollVaultController::class, 'initialize']);
