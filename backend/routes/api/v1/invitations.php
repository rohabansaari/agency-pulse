<?php

use App\Http\Controllers\Api\V1\InvitationController;
use Illuminate\Support\Facades\Route;

Route::middleware('rbac:admin,sub_admin,manager')->group(function () {
    Route::post('/send', [InvitationController::class, 'send']);
});
