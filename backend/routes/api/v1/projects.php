<?php



use App\Http\Controllers\Api\V1\ProjectAssignmentController;

use App\Http\Controllers\Api\V1\ProjectController;

use App\Http\Controllers\Api\V1\ProjectMemberController;

use Illuminate\Support\Facades\Route;



Route::get('/', [ProjectController::class, 'index']);

Route::get('/{project}', [ProjectController::class, 'show']);



Route::middleware('rbac:admin,sub_admin,manager')->group(function () {

    Route::post('/', [ProjectController::class, 'store']);

    Route::patch('/{project}/status', [ProjectController::class, 'updateStatus']);

    Route::put('/{project}', [ProjectController::class, 'update']);

    Route::patch('/{project}', [ProjectController::class, 'update']);



    Route::get('/{project}/assignees', [ProjectAssignmentController::class, 'assignees']);

    Route::post('/{project}/assign', [ProjectAssignmentController::class, 'assign']);

    Route::delete('/{project}/unassign/{user}', [ProjectAssignmentController::class, 'unassign']);



    Route::get('/{project}/members', [ProjectMemberController::class, 'index']);

    Route::post('/{project}/members', [ProjectMemberController::class, 'store']);

    Route::delete('/{project}/members/{user}', [ProjectMemberController::class, 'destroy']);

});

