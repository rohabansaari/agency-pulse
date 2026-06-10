<?php



use App\Http\Controllers\Api\V1\TeamsController;

use Illuminate\Support\Facades\Route;



Route::middleware('rbac:admin,sub_admin,manager')->get('/', [TeamsController::class, 'index']);

Route::middleware('rbac:admin,sub_admin')->group(function () {

    Route::post('/', [TeamsController::class, 'store']);

    Route::post('/{team}/assign-manager', [TeamsController::class, 'assignManager']);

    Route::post('/{team}/add-member', [TeamsController::class, 'addMember']);

    Route::delete('/{team}/remove-member/{user}', [TeamsController::class, 'removeMember']);

});

