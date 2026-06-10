<?php



use App\Http\Controllers\Api\V1\TeamController;

use Illuminate\Support\Facades\Route;



Route::middleware('rbac:admin,sub_admin')->group(function () {
    Route::get('/', [TeamController::class, 'index']);
    Route::get('/{user}/profile', [TeamController::class, 'profile']);
    Route::patch('/{member}', [TeamController::class, 'update']);
});

Route::middleware('rbac:admin')->group(function () {
    Route::post('/create-employee', [TeamController::class, 'createEmployee']);
    Route::post('/import-employees', [TeamController::class, 'importEmployees']);
    Route::get('/import-employees/sample.csv', [TeamController::class, 'sampleCsv']);
    Route::patch('/{user}/reset-password', [TeamController::class, 'resetPassword']);
    Route::post('/invite', [TeamController::class, 'invite']);
});

