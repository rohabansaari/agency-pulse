<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'name' => 'AgencyPulse API',
        'version' => 'v1',
        'docs' => '/api/v1/health',
    ]);
});

Route::fallback(function () {
    $frontendUrl = env('FRONTEND_URL', 'http://localhost:3000');

    if ($frontendUrl && ! request()->is('api/*') && ! request()->is('up')) {
        return redirect(rtrim($frontendUrl, '/').request()->getRequestUri());
    }

    abort(404);
});
