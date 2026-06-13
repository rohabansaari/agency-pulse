<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Routing\Controllers\HasMiddleware;

abstract class TenantController extends Controller implements HasMiddleware
{
    public static function middleware(): array
    {
        return [
            'auth:sanctum',
            'block.super.admin',
            'tenant',
            'idempotency',
        ];
    }
}
