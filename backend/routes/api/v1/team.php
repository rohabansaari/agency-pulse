<?php



use App\Http\Controllers\Api\V1\TeamController;

use Illuminate\Support\Facades\Route;



Route::middleware('rbac:admin')->group(function () {

    Route::get('/', [TeamController::class, 'index']);
    Route::get('/{user}/profile', [TeamController::class, 'profile']);

    Route::post('/create-employee', [TeamController::class, 'createEmployee']);

    Route::patch('/{user}/reset-password', [TeamController::class, 'resetPassword']);

    Route::patch('/{member}', [TeamController::class, 'update']);

    Route::post('/invite', [TeamController::class, 'invite']);

});

