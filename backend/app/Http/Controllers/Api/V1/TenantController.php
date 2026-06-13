<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;

abstract class TenantController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'block.super.admin', 'tenant', 'idempotency']);
    }
}
