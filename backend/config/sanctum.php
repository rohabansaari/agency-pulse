<?php

return [
    /*
    | API-first: no SPA cookie auth. Bearer tokens only.
    | Keep empty so Sanctum never treats frontend requests as stateful.
    */
    'stateful' => array_filter(explode(',', env('SANCTUM_STATEFUL_DOMAINS', ''))),

    'guard' => ['web'],

    'expiration' => null,

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],
];
