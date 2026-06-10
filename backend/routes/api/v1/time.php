<?php

use App\Http\Controllers\Api\V1\LeaveTimeEntryController;
use App\Http\Controllers\Api\V1\ManualTimeEntryController;
use App\Http\Controllers\Api\V1\OvertimeRequestController;
use App\Http\Controllers\Api\V1\TimeEntryController;
use Illuminate\Support\Facades\Route;

Route::post('/start', [TimeEntryController::class, 'start']);
Route::post('/stop', [TimeEntryController::class, 'stop']);
Route::get('/today', [TimeEntryController::class, 'today']);
Route::get('/personal-report', [TimeEntryController::class, 'personalReport']);

Route::get('/manual/context', [ManualTimeEntryController::class, 'context']);
Route::post('/manual', [ManualTimeEntryController::class, 'store']);
Route::get('/manual', [ManualTimeEntryController::class, 'index']);

Route::middleware('rbac:admin,sub_admin,manager')->group(function () {
    Route::get('/manual/pending', [ManualTimeEntryController::class, 'pending']);
    Route::post('/manual/{entry}/approve', [ManualTimeEntryController::class, 'approve']);
    Route::post('/manual/{entry}/reject', [ManualTimeEntryController::class, 'reject']);
});

Route::get('/leave/context', [LeaveTimeEntryController::class, 'context']);
Route::post('/leave', [LeaveTimeEntryController::class, 'store']);
Route::get('/leave', [LeaveTimeEntryController::class, 'index']);

Route::middleware('rbac:admin,sub_admin,manager')->group(function () {
    Route::get('/leave/pending', [LeaveTimeEntryController::class, 'pending']);
    Route::post('/leave/{entry}/approve', [LeaveTimeEntryController::class, 'approve']);
    Route::post('/leave/{entry}/reject', [LeaveTimeEntryController::class, 'reject']);
});

Route::middleware('rbac:admin,sub_admin')->patch('/leave/{entry}', [LeaveTimeEntryController::class, 'update']);

Route::middleware('rbac:admin,sub_admin,manager')->get('/organization', [TimeEntryController::class, 'organization']);

Route::get('/overtime/context', [OvertimeRequestController::class, 'context']);
Route::post('/overtime', [OvertimeRequestController::class, 'store']);
Route::get('/overtime', [OvertimeRequestController::class, 'index']);

Route::middleware('rbac:admin,sub_admin,manager')->group(function () {
    Route::get('/overtime/pending', [OvertimeRequestController::class, 'pending']);
    Route::post('/overtime/{overtimeRequest}/approve', [OvertimeRequestController::class, 'approve']);
    Route::post('/overtime/{overtimeRequest}/reject', [OvertimeRequestController::class, 'reject']);
});