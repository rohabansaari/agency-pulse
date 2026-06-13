<?php

use App\Http\Controllers\Api\V1\OnboardingController;
use Illuminate\Support\Facades\Route;

Route::get('/status', [OnboardingController::class, 'status']);
Route::patch('/organization', [OnboardingController::class, 'updateOrganization']);
Route::patch('/step', [OnboardingController::class, 'updateStep']);
Route::post('/skip-step', [OnboardingController::class, 'skipStep']);
Route::post('/employees', [OnboardingController::class, 'storeEmployee']);
Route::post('/employees/import', [OnboardingController::class, 'importEmployees']);
Route::get('/employees/sample.csv', [OnboardingController::class, 'sampleCsv']);
Route::post('/complete', [OnboardingController::class, 'complete']);
Route::patch('/step-completion', [OnboardingController::class, 'updateStepCompletion']);
